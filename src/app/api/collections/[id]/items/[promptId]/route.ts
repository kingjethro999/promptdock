import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { withTx, errorResponse } from "@/lib/community/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; promptId: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections:${viewer.id}`, { limit: 90, windowSec: 60 });

    const { id, promptId } = await params;
    if (!isUuid(id) || !isUuid(promptId)) {
      throw new HttpError(404, "not_found");
    }

    await withTx(async (client) => {
      // Check collection ownership
      const col = await client.query(
        `SELECT id FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid`,
        [id, viewer.id],
      );
      if (!col.rowCount) throw new HttpError(404, "not_found");

      const del = await client.query(
        `DELETE FROM collection_items WHERE collection_id = $1::uuid AND prompt_id = $2::uuid`,
        [id, promptId],
      );

      if ((del.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE collections SET updated_at = now() WHERE id = $1::uuid`,
          [id],
        );
      }
    });

    return Response.json(
      { removed: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
