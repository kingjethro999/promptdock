import { createRequire } from "node:module";
import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { errorResponse } from "@/lib/community/collections";
import { setPromptVisibility } from "@/lib/community/visibility";
import { scanPrompt, type Finding } from "@/lib/community/sensitive";

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
    await rateLimit(`collections-publish:${viewer.id}`, {
      limit: 30,
      windowSec: 60,
    });

    const { id } = await params;
    if (!isUuid(id)) {
      throw new HttpError(404, "not_found");
    }

    const body = (await req.json().catch(() => ({}))) as {
      listed?: boolean;
      acknowledgeWarn?: boolean;
    };
    const listed = Boolean(body.listed);
    const acknowledgeWarn = Boolean(body.acknowledgeWarn);

    await db.ensureSchema();

    // Verify collection ownership
    const colRes = await db.pool.query(
      `SELECT id, listed_in_community FROM collections WHERE id = $1::uuid AND owner_id = $2::uuid`,
      [id, viewer.id],
    );
    if (!colRes.rowCount) throw new HttpError(404, "not_found");

    // Fetch private prompts in this collection
    const itemsRes = await db.pool.query(
      `SELECT p.id, p.name, p.tags, p.data, p.visibility
         FROM collection_items ci
         JOIN prompts p ON p.id = ci.prompt_id
        WHERE ci.collection_id = $1::uuid AND p.deleted_at IS NULL
          AND COALESCE(p.visibility, 'private') = 'private'
        ORDER BY ci.position, ci.added_at, p.id`,
      [id],
    );

    const updated: string[] = [];
    const blocked: Array<{
      promptId: string;
      name: string;
      findings: Finding[];
    }> = [];
    const needsAck: Array<{
      promptId: string;
      name: string;
      findings: Finding[];
    }> = [];

    for (const prompt of itemsRes.rows) {
      const findings = scanPrompt({
        name: prompt.name,
        tags: prompt.tags,
        data: prompt.data,
      });

      const blockFindings = findings.filter((f) => f.severity === "block");
      if (blockFindings.length > 0) {
        blocked.push({
          promptId: prompt.id,
          name: prompt.name,
          findings: blockFindings,
        });
        continue;
      }

      const warnFindings = findings.filter((f) => f.severity === "warn");
      if (warnFindings.length > 0 && !acknowledgeWarn) {
        needsAck.push({
          promptId: prompt.id,
          name: prompt.name,
          findings: warnFindings,
        });
        continue;
      }

      // Safe to publish
      await setPromptVisibility(viewer, prompt.id, {
        visibility: "public",
        listed,
        acknowledgeWarn: true,
      });
      updated.push(prompt.id);
    }

    return Response.json(
      { updated, blocked, needsAck },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
