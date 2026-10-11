import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import type { Visibility } from "@/lib/community/access";

const db = require("../../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`visibility:${viewer.id}`, { limit: 60, windowSec: 60 });

    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      visibility?: Visibility;
      listed?: boolean;
    };

    const validVisibilities: Visibility[] = ["private", "followers", "public"];
    const visibility: Visibility = validVisibilities.includes(
      body.visibility as Visibility,
    )
      ? (body.visibility as Visibility)
      : "private";

    const listed = visibility === "private" ? false : Boolean(body.listed);
    const newPublicId = randomUUID();
    const ownerKey = db.accountKey(viewer.id);

    await db.ensureSchema();
    const result = await db.pool.query(
      `UPDATE prompts SET
         visibility = $2,
         listed_in_community = $3::boolean,
         listed_at = CASE WHEN $3::boolean AND NOT listed_in_community THEN now()
                          WHEN NOT $3::boolean THEN NULL ELSE listed_at END,
         public_id = COALESCE(public_id, $4::uuid),
         owner_id = $5::uuid
       WHERE id = $1::uuid AND (owner_id = $5::uuid OR owner_key = $6)
       RETURNING id, public_id AS "publicId", visibility, listed_in_community AS "listedInCommunity", listed_at AS "listedAt"`,
      [id, visibility, listed, newPublicId, viewer.id, ownerKey],
    );

    if (result.rowCount === 0) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const row = result.rows[0];

    try {
      revalidatePath("/community");
      if (viewer.username) {
        revalidatePath(`/${viewer.username}`);
      }
      if (row.publicId) {
        revalidatePath(`/p/${row.publicId}`);
      }
    } catch {}

    return Response.json(
      {
        id: row.id,
        publicId: row.publicId,
        visibility: row.visibility,
        listedInCommunity: row.listedInCommunity,
        listedAt: row.listedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Visibility update error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
