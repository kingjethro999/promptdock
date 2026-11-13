import { requireViewer } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { validateUsername } from "@/lib/community/username";
import { HttpError } from "@/lib/community/save";

const db = require("../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live availability for the profile handle field. Applies the same rules and
 * checks the same tables (current handles and retired aliases) as the
 * profile save, so "available" here means the save will accept it.
 */
export async function GET(req: Request) {
  try {
    const viewer = await requireViewer();
    await rateLimit(`handle-check:${viewer.id}`, { limit: 90, windowSec: 60 });
    const raw = new URL(req.url).searchParams.get("handle") || "";
    const valid = validateUsername(raw);
    if (!valid.ok)
      return Response.json(
        { available: false, reason: valid.reason },
        { headers: { "Cache-Control": "no-store" } },
      );
    await db.ensureSchema();
    const { rows } = await db.pool.query(
      `SELECT 1 FROM users WHERE lower(username) = $1 AND id <> $2::uuid
       UNION ALL
       SELECT 1 FROM username_aliases WHERE lower(alias) = $1 AND user_id <> $2::uuid
       LIMIT 1`,
      [valid.value, viewer.id],
    );
    return Response.json(
      rows.length ? { available: false, reason: "taken" } : { available: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (err instanceof HttpError)
      return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
