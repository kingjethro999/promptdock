import { requireViewer, assertSameOrigin } from "@/lib/community/viewer";
import { rateLimit } from "@/lib/community/ratelimit";
import { getUserByHandle, followerCount } from "@/lib/community/queries";
import { HttpError } from "@/lib/community/save";

const db = require("../../../../../database");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`follow:${viewer.id}`, { limit: 30, windowSec: 60 });

    const { username } = await params;
    const target = await getUserByHandle(username);
    if (!target) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    if (target.id === viewer.id) {
      return Response.json({ error: "cannot_follow_self" }, { status: 400 });
    }

    await db.ensureSchema();
    await db.pool.query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING`,
      [viewer.id, target.id],
    );

    const count = await followerCount(target.id);
    return Response.json(
      { following: true, followerCount: count },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Follow error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const viewer = await requireViewer();
    assertSameOrigin(req);
    await rateLimit(`follow:${viewer.id}`, { limit: 30, windowSec: 60 });

    const { username } = await params;
    const target = await getUserByHandle(username);
    if (!target) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    await db.ensureSchema();
    await db.pool.query(
      `DELETE FROM follows WHERE follower_id = $1::uuid AND followee_id = $2::uuid`,
      [viewer.id, target.id],
    );

    const count = await followerCount(target.id);
    return Response.json(
      { following: false, followerCount: count },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return Response.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Unfollow error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
