import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { withTx, errorResponse } from "@/lib/community/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections-order:${viewer.id}`, {
      limit: 60,
      windowSec: 60,
    });

    const { id } = await params;
    if (!isUuid(id)) {
      throw new HttpError(404, "not_found");
    }

    const body = (await req.json().catch(() => ({}))) as {
      promptIds?: string[];
    };
    const promptIds = body.promptIds;
    if (!Array.isArray(promptIds) || !promptIds.every(isUuid)) {
      throw new HttpError(400, "invalid_prompt_ids");
    }

    await withTx(async (c) => {
      const lockRes = await c.query(
        `SELECT 1 FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid FOR UPDATE`,
        [id, viewer.id],
      );
      if (!lockRes.rowCount) throw new HttpError(404, "not_found");

      const itemsRes = await c.query<{ prompt_id: string }>(
        `SELECT prompt_id FROM collection_items WHERE collection_id = $1::uuid`,
        [id],
      );
      const cur = new Set(itemsRes.rows.map((r) => r.prompt_id));
      const next = new Set(promptIds);

      if (
        promptIds.length !== next.size ||
        next.size !== cur.size ||
        [...cur].some((p) => !next.has(p))
      ) {
        throw new HttpError(409, "stale");
      }

      await c.query(
        `UPDATE collection_items ci
            SET position = o.ord
           FROM unnest($2::uuid[]) WITH ORDINALITY AS o(pid, ord)
          WHERE ci.collection_id = $1::uuid AND ci.prompt_id = o.pid`,
        [id, promptIds],
      );

      await c.query(
        `UPDATE collections SET updated_at = now() WHERE id = $1::uuid`,
        [id],
      );
    });

    return Response.json(
      { ordered: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
