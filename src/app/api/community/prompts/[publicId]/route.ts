import { getViewer } from "@/lib/community/viewer";
import { getPromptForViewer } from "@/lib/community/queries";

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
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json(
    {
      publicId: prompt.publicId,
      name: prompt.name,
      data: prompt.data,
      tags: prompt.tags,
      creator: {
        username: prompt.username,
        displayName: prompt.displayName,
        avatarUrl: prompt.avatarUrl,
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
