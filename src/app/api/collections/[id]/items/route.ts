import { createRequire } from "node:module";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { withTx, errorResponse } from "@/lib/community/collections";

const req = createRequire(import.meta.url);
const db = req("../../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isUuid(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`collections:${viewer.id}`, { limit: 90, windowSec: 60 });

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { promptId?: string };
    const promptId = body.promptId;

    if (!isUuid(id) || !isUuid(promptId)) {
      throw new HttpError(404, "not_found");
    }

    const out = await withTx(async (client) => {
      // Lock collection for update
      const col = await client.query(
        `SELECT id, owner_id FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid FOR UPDATE`,
        [id, viewer.id],
      );
      if (!col.rowCount) throw new HttpError(404, "not_found");

      // Verify prompt belongs to user
      const prompt = await client.query(
        `SELECT id FROM prompts WHERE id = $1::uuid AND deleted_at IS NULL AND (owner_id = $2::uuid OR owner_key = $3)`,
        [promptId, viewer.id, db.accountKey(viewer.id)],
      );
      if (!prompt.rowCount) throw new HttpError(404, "not_found");

      // Check current items count and max position
      const nRes = await client.query<{ n: number; top: number }>(
        `SELECT count(*)::int AS n, COALESCE(max(position), 0)::int AS top
         FROM collection_items WHERE collection_id = $1::uuid`,
        [id],
      );
      const n = Number(nRes.rows[0]?.n ?? 0);
      const top = Number(nRes.rows[0]?.top ?? 0);

      // Check if item already exists
      const existsRes = await client.query(
        `SELECT 1 FROM collection_items WHERE collection_id = $1::uuid AND prompt_id = $2::uuid`,
        [id, promptId],
      );
      if ((existsRes.rowCount ?? 0) > 0) {
        return { added: false, count: n };
      }

      // Check 200 limit for new additions
      if (n >= 200) {
        throw new HttpError(409, "full");
      }

      await client.query(
        `INSERT INTO collection_items (collection_id, prompt_id, position)
         VALUES ($1::uuid, $2::uuid, $3)`,
        [id, promptId, top + 1],
      );

      await client.query(
        `UPDATE collections SET updated_at = now() WHERE id = $1::uuid`,
        [id],
      );

      return { added: true, count: n + 1 };
    });

    return Response.json(out, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
