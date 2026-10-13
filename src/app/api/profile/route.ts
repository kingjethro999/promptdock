import { revalidatePath } from "next/cache";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { assertOwnedAsset } from "@/lib/community/uploads";
import { validateUsername, normalizeUsername } from "@/lib/community/username";
import { HttpError } from "@/lib/community/save";
import type { Audience } from "@/lib/community/access";
import { PRESET_IDS } from "@/lib/profile/banner-presets";
import { cleanDisplayName, cleanBio } from "@/lib/profile/validate";

const db = require("../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await requireViewer();
    await db.ensureSchema();
    const { rows } = await db.pool.query(
      `SELECT id, username, display_name AS "displayName", avatar_url AS "avatarUrl",
              banner_url AS "bannerUrl", banner_preset AS "bannerPreset", bio, community_audience AS "communityAudience",
              username_changed_at AS "usernameChangedAt"
       FROM users WHERE id = $1::uuid`,
      [viewer.id],
    );
    if (!rows[0]) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(rows[0], {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`profile:${viewer.id}`, { limit: 20, windowSec: 60 });

    const body = (await req.json().catch(() => ({}))) as {
      displayName?: string | null;
      username?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bannerPreset?: string | null;
      communityAudience?: Audience;
    };

    await db.ensureSchema();

    // Verify avatarUrl & bannerUrl
    if (body.avatarUrl) {
      assertOwnedAsset(body.avatarUrl, viewer.id);
    }
    if (body.bannerUrl) {
      assertOwnedAsset(body.bannerUrl, viewer.id);
    }
    if (body.bannerPreset !== undefined && body.bannerPreset !== null) {
      if (!PRESET_IDS.has(body.bannerPreset)) {
        throw new HttpError(400, "invalid_preset");
      }
    }

    // Clean text fields using shared profile validation
    let displayName: string | null | undefined = undefined;
    if ("displayName" in body) {
      const r = cleanDisplayName(body.displayName);
      if (!r.ok) {
        throw new HttpError(400, `invalid_display_name_${r.reason}`);
      }
      displayName = r.value;
    }

    let bio: string | null | undefined = undefined;
    if ("bio" in body) {
      const r = cleanBio(body.bio);
      if (!r.ok) {
        throw new HttpError(400, `invalid_bio_${r.reason}`);
      }
      bio = r.value;
    }

    const audience: Audience | undefined =
      body.communityAudience === "followers"
        ? "followers"
        : body.communityAudience === "public"
          ? "public"
          : undefined;

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        `SELECT id, username, username_changed_at FROM users WHERE id = $1::uuid FOR UPDATE`,
        [viewer.id],
      );
      if (!userRes.rows[0]) {
        throw new HttpError(404, "user_not_found");
      }
      const currentUser = userRes.rows[0];

      // Handle username change if requested
      if (body.username && typeof body.username === "string") {
        const next = normalizeUsername(body.username);
        if (
          next !==
          (currentUser.username ? currentUser.username.toLowerCase() : "")
        ) {
          const val = validateUsername(next);
          if (!val.ok) {
            throw new HttpError(400, `invalid_username_${val.reason}`);
          }

          if (
            currentUser.username_changed_at &&
            Date.now() - +new Date(currentUser.username_changed_at) < 30 * 864e5
          ) {
            throw new HttpError(429, "username_cooldown");
          }

          // Check if alias is held by another user
          const aliasCheck = await client.query(
            `SELECT 1 FROM username_aliases WHERE lower(alias) = $1 AND user_id <> $2::uuid`,
            [next, viewer.id],
          );
          if (aliasCheck.rows[0]) {
            throw new HttpError(409, "username_taken");
          }

          // Check if username taken by another user in users
          const userCheck = await client.query(
            `SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2::uuid`,
            [next, viewer.id],
          );
          if (userCheck.rows[0]) {
            throw new HttpError(409, "username_taken");
          }

          // Reclaiming own old handle
          await client.query(
            `DELETE FROM username_aliases WHERE lower(alias) = $1 AND user_id = $2::uuid`,
            [next, viewer.id],
          );

          // Add previous username to aliases if it existed
          if (currentUser.username) {
            await client.query(
              `INSERT INTO username_aliases (alias, user_id) VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING`,
              [currentUser.username.toLowerCase(), viewer.id],
            );
          }

          await client.query(
            `UPDATE users SET username = $2, username_changed_at = now() WHERE id = $1::uuid`,
            [viewer.id, next],
          );
        }
      }

      // Update remaining profile fields
      const updates: string[] = [];
      const params: unknown[] = [viewer.id];
      const addParam = (v: unknown) => {
        params.push(v);
        return `$${params.length}`;
      };

      if (displayName !== undefined) {
        updates.push(`display_name = ${addParam(displayName)}`);
      }
      if (bio !== undefined) {
        updates.push(`bio = ${addParam(bio)}`);
      }
      if (body.avatarUrl !== undefined) {
        updates.push(`avatar_url = ${addParam(body.avatarUrl)}`);
      }
      if (body.bannerUrl !== undefined) {
        if (body.bannerUrl !== null) {
          updates.push(`banner_url = ${addParam(body.bannerUrl)}`);
          updates.push(`banner_preset = NULL`);
        } else {
          updates.push(`banner_url = NULL`);
        }
      }
      if (body.bannerPreset !== undefined) {
        if (body.bannerPreset !== null) {
          updates.push(`banner_preset = ${addParam(body.bannerPreset)}`);
          updates.push(`banner_url = NULL`);
        } else {
          updates.push(`banner_preset = NULL`);
        }
      }
      if (audience !== undefined) {
        updates.push(`community_audience = ${addParam(audience)}`);
      }

      if (updates.length > 0) {
        await client.query(
          `UPDATE users SET ${updates.join(", ")} WHERE id = $1::uuid`,
          params,
        );
      }

      const updated = await client.query(
        `SELECT id, username, display_name AS "displayName", avatar_url AS "avatarUrl",
                banner_url AS "bannerUrl", banner_preset AS "bannerPreset", bio, community_audience AS "communityAudience"
         FROM users WHERE id = $1::uuid`,
        [viewer.id],
      );

      await client.query("COMMIT");

      try {
        revalidatePath("/community");
        if (updated.rows[0]?.username) {
          revalidatePath(`/${updated.rows[0].username}`);
        }
      } catch {}

      return Response.json(updated.rows[0], {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Profile update error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
