import { getViewer } from "@/lib/community/viewer";
import { getPromptForViewer } from "@/lib/community/queries";
import { buildPrompt } from "@/lib/prompt/format";
import type { PromptData } from "@/lib/prompt/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const viewer = await getViewer();

  const prompt = await getPromptForViewer(publicId, viewer?.id ?? null);
  if (!prompt) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const text = buildPrompt(prompt.data as unknown as PromptData);
  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
