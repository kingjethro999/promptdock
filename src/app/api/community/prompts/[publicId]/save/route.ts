import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { savePrompt, HttpError } from "@/lib/community/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`save:${viewer.id}`, { limit: 30, windowSec: 60 });

    const { publicId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      origin?: "save" | "remix";
    };
    const origin = body.origin === "remix" ? "remix" : "save";

    const result = await savePrompt(viewer.id, publicId, origin);
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Save prompt error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
