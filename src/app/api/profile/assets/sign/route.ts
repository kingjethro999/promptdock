import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { signCloudinaryUpload, HttpError } from "@/lib/community/uploads";
import type { UploadKind } from "@/lib/community/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`sign:${viewer.id}`, { limit: 30, windowSec: 60 });

    const body = (await req.json().catch(() => ({}))) as { kind?: UploadKind };
    if (!body.kind || (body.kind !== "avatar" && body.kind !== "banner")) {
      return Response.json({ error: "invalid_kind" }, { status: 400 });
    }

    const payload = signCloudinaryUpload(viewer.id, body.kind);
    return Response.json(payload, {
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
    console.error("Asset signing error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
