import { getViewer } from "@/lib/community/viewer";
import { listCommunityCreators } from "@/lib/community/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const viewer = await getViewer();
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit")) || 24;

    const items = await listCommunityCreators({
      viewerId: viewer?.id ?? null,
      q,
      limit,
    });

    return Response.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    console.error("Creators listing error:", err);
    return Response.json({ items: [] }, { status: 500 });
  }
}
