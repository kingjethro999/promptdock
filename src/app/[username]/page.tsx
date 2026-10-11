import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  USERNAME_RE,
  RESERVED,
  normalizeUsername,
} from "@/lib/community/username";
import { getViewer } from "@/lib/community/viewer";
import {
  getPublicProfile,
  listCommunityPrompts,
  getFollowState,
  resolveHandle,
} from "@/lib/community/queries";
import ProfileHeader from "@/components/community/ProfileHeader";
import PromptGrid from "@/components/community/PromptGrid";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const handle = normalizeUsername(username);
  const r =
    USERNAME_RE.test(handle) && !RESERVED.has(handle)
      ? await resolveHandle(handle)
      : null;

  if (!r) {
    return { title: "PromptDock Community", robots: { index: false } };
  }

  const p = await getPublicProfile(r.userId, null);
  if (!p) {
    return { title: "PromptDock Community", robots: { index: false } };
  }

  const isAudienceFollowers = p.communityAudience === "followers";

  const title = `${p.displayName} (@${p.username}) on PromptDock`;
  const description =
    p.bio ?? `Prompts shared by ${p.displayName} on PromptDock Community.`;
  const image = `/api/og/u/${p.username}`;

  return {
    title,
    description,
    alternates: { canonical: `/${p.username}` },
    robots: isAudienceFollowers ? { index: false } : undefined,
    openGraph: {
      type: "profile",
      title,
      description,
      url: `/${p.username}`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const handle = normalizeUsername(username);
  if (!USERNAME_RE.test(handle) || RESERVED.has(handle)) {
    notFound();
  }

  const resolved = await resolveHandle(handle);
  if (!resolved) {
    notFound();
  }

  if (resolved.username !== handle) {
    permanentRedirect(`/${resolved.username}`);
  }

  const viewer = await getViewer();
  const [profile, firstPage, follow] = await Promise.all([
    getPublicProfile(resolved.userId, viewer?.id ?? null),
    listCommunityPrompts({
      viewerId: viewer?.id ?? null,
      creatorId: resolved.userId,
    }),
    viewer
      ? getFollowState(viewer.id, resolved.userId)
      : Promise.resolve(false),
  ]);

  if (!profile) {
    notFound();
  }

  profile.following = follow;

  return (
    <div className="community-container">
      <ProfileHeader profile={profile} />

      <section style={{ marginTop: 32 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--community-text)",
            marginBottom: 20,
          }}
        >
          Shared Prompts
        </h2>

        <PromptGrid
          initial={firstPage}
          creatorId={resolved.userId}
          showFilters={false}
        />
      </section>
    </div>
  );
}
