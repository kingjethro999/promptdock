import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { revalidatePath } from "next/cache";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { errorResponse } from "@/lib/community/collections";
import type { Visibility } from "@/lib/community/access";

const req = createRequire(import.meta.url);
const db = req("../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections-write:${viewer.id}`, {
      limit: 60,
      windowSec: 60,
    });

    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw new HttpError(404, "not_found");
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      visibility?: Visibility;
      listed?: boolean;
    };

    await db.ensureSchema();

    const existingRes = await db.pool.query(
      `SELECT id, name, description, visibility, listed_in_community AS listed, public_id AS "publicId"
       FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid`,
      [id, viewer.id],
    );

    if (existingRes.rowCount === 0) {
      throw new HttpError(404, "not_found");
    }

    const existing = existingRes.rows[0];

    let name = existing.name;
    if (body.name !== undefined) {
      const trimmed = String(body.name).trim();
      if (!trimmed || trimmed.length > 80)
        throw new HttpError(400, "invalid_name");

      // Check unique name constraint if name changed
      if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
        const dup = await db.pool.query(
          `SELECT id FROM collections WHERE owner_id = $1::uuid AND lower(name) = lower($2) AND id <> $3::uuid`,
          [viewer.id, trimmed, id],
        );
        if (dup.rowCount > 0) {
          return Response.json(
            { error: "name_taken", existingId: dup.rows[0].id },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
      }
      name = trimmed;
    }

    let description = existing.description;
    if (body.description !== undefined) {
      description = body.description ? String(body.description).trim() : null;
      if (description && description.length > 300) {
        throw new HttpError(400, "description_too_long");
      }
    }

    let visibility: Visibility = existing.visibility;
    if (body.visibility !== undefined) {
      const valid: Visibility[] = ["private", "followers", "public"];
      if (valid.includes(body.visibility)) {
        visibility = body.visibility;
      }
    }

    const listed =
      visibility === "private"
        ? false
        : body.listed !== undefined
          ? Boolean(body.listed)
          : existing.listed;

    let publicId = existing.publicId;
    if (visibility !== "private" && !publicId) {
      publicId = randomUUID();
    }

    const updateRes = await db.pool.query(
      `UPDATE collections SET
         name = $2,
         description = $3,
         visibility = $4,
         listed_in_community = $5,
         listed_at = CASE WHEN $5 AND NOT listed_in_community THEN now()
                          WHEN NOT $5 THEN NULL ELSE listed_at END,
         public_id = $6,
         updated_at = now()
       WHERE id = $1::uuid AND owner_id = $7::uuid
       RETURNING id, name, description, visibility, listed_in_community AS listed, public_id AS "publicId", updated_at AS "updatedAt"`,
      [id, name, description, visibility, listed, publicId, viewer.id],
    );

    const row = updateRes.rows[0];

    try {
      revalidatePath("/community");
      if (viewer.username) revalidatePath(`/${viewer.username}`);
      if (row.publicId) revalidatePath(`/c/${row.publicId}`);
    } catch {}

    return Response.json(row, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections-write:${viewer.id}`, {
      limit: 60,
      windowSec: 60,
    });

    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw new HttpError(404, "not_found");
    }

    await db.ensureSchema();
    const result = await db.pool.query(
      `DELETE FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid RETURNING public_id AS "publicId"`,
      [id, viewer.id],
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "not_found");
    }

    const publicId = result.rows[0].publicId;
    try {
      revalidatePath("/community");
      if (viewer.username) revalidatePath(`/${viewer.username}`);
      if (publicId) revalidatePath(`/c/${publicId}`);
    } catch {}

    return Response.json(
      { deleted: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
