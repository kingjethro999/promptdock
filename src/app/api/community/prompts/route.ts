import { getViewer } from "@/lib/community/viewer";
import { rateLimit, clientIp } from "@/lib/community/ratelimit";
import { listCommunityPrompts } from "@/lib/community/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const viewer = await getViewer();
    await rateLimit(`community:${viewer?.id ?? clientIp(req)}`, {
      limit: 60,
      windowSec: 60,
    });

    const u = new URL(req.url);
    const q = u.searchParams.get("q") || undefined;
    const tags = u.searchParams.getAll("tag");
    const sortParam = u.searchParams.get("sort");
    const sort = sortParam === "old" ? "old" : "new";
    const cursor = u.searchParams.get("cursor") || undefined;
    const limitParam = u.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 24;

    const data = await listCommunityPrompts({
      viewerId: viewer?.id ?? null,
      q,
      tags: tags.length > 0 ? tags : undefined,
      sort,
      cursor,
      limit: Number.isFinite(limit) ? limit : 24,
    });

    return Response.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 429) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    console.error("Community feed error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
