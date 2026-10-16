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
import { Icon } from "@/components/ui/Icon";
import { listProfileCollections } from "@/lib/community/collections";

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
  const [profile, firstPage, follow, collections] = await Promise.all([
    getPublicProfile(resolved.userId, viewer?.id ?? null),
    listCommunityPrompts({
      viewerId: viewer?.id ?? null,
      creatorId: resolved.userId,
    }),
    viewer
      ? getFollowState(viewer.id, resolved.userId)
      : Promise.resolve(false),
    listProfileCollections(resolved.userId, viewer?.id ?? null),
  ]);

  if (!profile) {
    notFound();
  }

  profile.following = follow;

  return (
    <div className="community-container">
      <ProfileHeader profile={profile} />

      {collections.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--community-text)",
              marginBottom: 16,
            }}
          >
            Playlists &amp; Series
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {collections.map((col) => (
              <a
                key={col.id}
                href={`/c/${col.publicId}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 20px",
                  background: "#fff",
                  border: "1px solid #dfe8db",
                  borderRadius: "14px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ui-accent, #246a48)",
                    }}
                  >
                    <Icon name="folder" size={14} /> Playlist
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#687a6d",
                      background: "#f2f7ef",
                      padding: "2px 8px",
                      borderRadius: 12,
                    }}
                  >
                    {col.count} prompt{col.count === 1 ? "" : "s"}
                  </span>
                </div>
                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1c3929",
                  }}
                >
                  {col.name}
                </h3>
                {col.description && (
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: 13,
                      color: "#566860",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {col.description}
                  </p>
                )}
                {col.sampleTitles.length > 0 && (
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 10,
                      borderTop: "1px solid #f0f4ee",
                      fontSize: 12,
                      color: "#687a6d",
                    }}
                  >
                    {col.sampleTitles.map((title, i) => (
                      <div
                        key={i}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.6,
                        }}
                      >
                        {i + 1}. {title}
                      </div>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

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
