export type Visibility = "private" | "followers" | "public";
export type Audience = "public" | "followers";

/** Effective visibility = the stricter of the prompt's setting and the creator's audience cap. Use this in the UI too. */
export function effectiveVisibility(
  prompt: Visibility,
  audience?: Audience,
): Visibility {
  if (prompt === "private") return "private";
  const aud = audience || "public";
  if (prompt === "followers" || aud === "followers") return "followers";
  return "public";
}

export function canView(a: {
  viewerId: string | null;
  ownerId: string;
  visibility: Visibility;
  audience?: Audience;
  viewerFollowsOwner: boolean;
}): boolean {
  if (a.viewerId && a.viewerId === a.ownerId) return true;
  const aud = a.audience || "public";
  switch (effectiveVisibility(a.visibility, aud)) {
    case "public":
      return true;
    case "followers":
      return a.viewerId !== null && a.viewerFollowsOwner;
    default:
      return false;
  }
}

/** SQL twin of canView. p = prompts, u = prompt owner (users). `v` is the viewer placeholder, e.g. "$2" (may bind NULL). */
export const visibleToViewerSql = (v: string) => `(
  (p.owner_id IS NOT NULL AND ${v}::uuid IS NOT NULL AND p.owner_id = ${v}::uuid)
  OR (COALESCE(p.visibility, 'public') = 'public' AND COALESCE(u.community_audience, 'public') = 'public')
  OR (COALESCE(p.visibility, 'public') IN ('public','followers') AND ${v}::uuid IS NOT NULL
      AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${v}::uuid AND f.followee_id = p.owner_id))
)`;

/** Global feed and search. Ignores the viewer on purpose: the feed is the same for everyone. */
export const GLOBAL_FEED_SQL = `p.listed_in_community AND COALESCE(p.visibility, 'public') = 'public' AND COALESCE(u.community_audience, 'public') = 'public' AND p.deleted_at IS NULL`;
