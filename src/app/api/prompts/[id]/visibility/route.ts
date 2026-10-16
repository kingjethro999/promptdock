import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { HttpError } from "@/lib/community/save";
import { setPromptVisibility } from "@/lib/community/visibility";
import type { Visibility } from "@/lib/community/access";

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
      acknowledgeWarn?: boolean;
    };

    const row = await setPromptVisibility(viewer, id, {
      visibility: body.visibility,
      listed: body.listed,
      acknowledgeWarn: body.acknowledgeWarn,
    });

    return Response.json(row, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      const findings = (err as { findings?: unknown }).findings;
      return Response.json(
        { error: err.message, findings },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Visibility update error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
