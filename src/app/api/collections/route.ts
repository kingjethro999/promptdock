import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { errorResponse } from "@/lib/community/collections";
import type { Visibility } from "@/lib/community/access";

const req = createRequire(import.meta.url);
const db = req("../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const viewer = await requireViewer();
    await rateLimit(`collections-read:${viewer.id}`, {
      limit: 120,
      windowSec: 60,
    });

    const url = new URL(req.url);
    const promptId = url.searchParams.get("prompt");
    const validPromptId =
      promptId && /^[0-9a-f-]{36}$/i.test(promptId) ? promptId : null;

    await db.ensureSchema();
    const { rows } = await db.pool.query(
      `SELECT c.id, c.name, c.description, c.visibility,
              c.listed_in_community AS listed, c.public_id AS "publicId",
              c.updated_at AS "updatedAt",
              count(ci.prompt_id)::int AS count,
              BOOL_OR(ci.prompt_id = $2::uuid) IS TRUE AS "hasPrompt"
         FROM collections c
         LEFT JOIN collection_items ci ON ci.collection_id = c.id
        WHERE c.owner_id = $1::uuid
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT 100`,
      [viewer.id, validPromptId],
    );

    return Response.json(
      { collections: rows },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections-write:${viewer.id}`, {
      limit: 60,
      windowSec: 60,
    });

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      visibility?: Visibility;
      listed?: boolean;
    };

    const name = String(body.name || "").trim();
    if (!name || name.length > 80) {
      throw new HttpError(400, "invalid_name");
    }

    const description = body.description
      ? String(body.description).trim()
      : null;
    if (description && description.length > 300) {
      throw new HttpError(400, "description_too_long");
    }

    const validVisibilities: Visibility[] = ["private", "followers", "public"];
    const visibility: Visibility = validVisibilities.includes(
      body.visibility as Visibility,
    )
      ? (body.visibility as Visibility)
      : "private";

    const listed = visibility === "private" ? false : Boolean(body.listed);
    const publicId = visibility !== "private" ? randomUUID() : null;

    await db.ensureSchema();

    // Check 50 collections limit
    const countRes = await db.pool.query(
      `SELECT count(*)::int AS total FROM collections WHERE owner_id = $1::uuid`,
      [viewer.id],
    );
    if (countRes.rows[0].total >= 50) {
      throw new HttpError(409, "collection_limit_reached");
    }

    // Check duplicate name
    const existing = await db.pool.query(
      `SELECT id FROM collections WHERE owner_id = $1::uuid AND lower(name) = lower($2)`,
      [viewer.id, name],
    );
    if (existing.rowCount > 0) {
      return Response.json(
        { error: "name_taken", existingId: existing.rows[0].id },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const insertRes = await db.pool.query(
      `INSERT INTO collections (
         owner_id, name, description, visibility, listed_in_community, listed_at, public_id
       ) VALUES ($1::uuid, $2, $3, $4, $5, CASE WHEN $5 THEN now() ELSE NULL END, $6)
       RETURNING id, name, description, visibility, listed_in_community AS listed, public_id AS "publicId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [viewer.id, name, description, visibility, listed, publicId],
    );

    return Response.json(insertRes.rows[0], {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
