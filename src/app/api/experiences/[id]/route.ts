import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { EXPERIENCES, FLOWS } from "@/lib/onboarding/registry";

const db = require("../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["shown", "completed", "skipped", "dismissed"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`exp:${viewer.id}`, { limit: 30, windowSec: 60 });

    const { id } = await params;
    const exp = EXPERIENCES.find((e) => e.id === id);
    const flow = FLOWS.find((f) => f.id === id);
    const known = exp ?? flow;
    if (!known) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const maxSteps = exp ? exp.steps.length : flow!.steps;
    const body = (await req.json().catch(() => null)) as {
      status?: string;
      step?: number;
    } | null;

    if (
      !body ||
      !body.status ||
      !STATUSES.has(body.status) ||
      !Number.isInteger(body.step) ||
      body.step! < 0 ||
      body.step! > maxSteps
    ) {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }

    await db.ensureSchema();
    await db.pool.query(
      `INSERT INTO user_experiences (user_id, experience_id, status, step_reached) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, experience_id) DO UPDATE SET
         status       = CASE WHEN user_experiences.status = 'shown' THEN EXCLUDED.status ELSE user_experiences.status END,
         step_reached = GREATEST(user_experiences.step_reached, EXCLUDED.step_reached),
         updated_at   = now()`,
      [viewer.id, id, body.status, body.step],
    );

    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("Experience update error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
