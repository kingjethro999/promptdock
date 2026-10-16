import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCollectionForViewer,
  listItemsForVisitor,
} from "@/lib/community/collections";
import { getViewer } from "@/lib/community/viewer";
import { clean } from "@/lib/og/text";
import { Glyph, Icon } from "@/components/ui";
import FollowButton from "@/components/community/FollowButton";
import CopyButton from "./CopyButton";

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const col = await getCollectionForViewer(publicId, null).catch(() => null);
  if (!col) {
    return { title: "Playlist not found", robots: { index: false } };
  }

  const title = `${col.name} — Playlist by @${col.username}`;
  const description = clean(
    col.description ||
      `A curated prompt playlist by ${col.displayName || col.username} on PromptDock.`,
    180,
  );
  const image = `/api/og/c/${publicId}?v=${new Date(col.updatedAt ?? 0).getTime()}`;

  return {
    title,
    description,
    alternates: { canonical: `/c/${publicId}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/c/${publicId}`,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicCollectionPage({ params }: Props) {
  const { publicId } = await params;
  const viewer = await getViewer();
  const collection = await getCollectionForViewer(
    publicId,
    viewer?.id ?? null,
  ).catch(() => null);

  if (!collection) notFound();

  const items = await listItemsForVisitor(
    collection.id,
    viewer?.id ?? null,
  ).catch(() => []);

  const creatorName =
    collection.displayName || collection.username || "PromptDock creator";

  return (
    <div className="shared-page">
      <header className="shared-header">
        <Link className="shared-brand" href="/">
          <Glyph name="spark" size={14} /> prompt<em>dock</em>
        </Link>
        <Link href="/workspace" className="shared-home-link">
          Create your own prompt{" "}
          <Icon
            name="arrow-up-right"
            size={13}
            style={{ display: "inline-block", verticalAlign: "middle" }}
          />
        </Link>
      </header>

      <main className="shared-main" style={{ maxWidth: "880px" }}>
        <div className="shared-topline">
          <span>
            <Icon name="library" size={13} /> PROMPT PLAYLIST
          </span>
          <span>
            {items.length} prompt{items.length === 1 ? "" : "s"} in sequence
          </span>
        </div>

        {/* Creator subheader */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "#fff",
            border: "1px solid #e4ebdc",
            borderRadius: "14px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {collection.avatarUrl ? (
              <img
                src={collection.avatarUrl}
                alt={creatorName}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "#e6f6d3",
                  color: "#2b5536",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {creatorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <Link
                href={`/${collection.username}`}
                style={{
                  fontWeight: 700,
                  fontSize: "15px",
                  color: "#1c3929",
                  textDecoration: "none",
                }}
              >
                {creatorName}
              </Link>
              <div style={{ fontSize: "12px", color: "#687a6d" }}>
                @{collection.username}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CopyButton
              url={`/c/${collection.publicId}`}
              label="Share playlist"
            />
            {!collection.isOwner && (
              <FollowButton
                username={collection.username}
                initialFollowing={false}
                initialCount={0}
              />
            )}
          </div>
        </div>

        {/* Collection Hero */}
        <section className="shared-hero">
          <div>
            <div className="shared-eyebrow">
              {collection.visibility === "followers"
                ? "FOLLOWERS ONLY PLAYLIST"
                : "PUBLIC PLAYLIST"}
            </div>
            <h1>{collection.name}</h1>
            {collection.description ? (
              <p>{collection.description}</p>
            ) : (
              <p>
                A sequence of prompts curated by {creatorName}. Work through
                them step-by-step or save them to your library.
              </p>
            )}
            <div className="shared-meta">
              <span>
                {items.length} step{items.length === 1 ? "" : "s"}
              </span>
              <span>
                Updated {new Date(collection.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="shared-symbol" aria-hidden="true">
            <Icon name="folder" size={32} />
          </div>
        </section>

        {/* Playlist Items */}
        <section style={{ marginTop: "28px" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#687a6d",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "14px",
            }}
          >
            Series Prompts
          </div>

          {items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#fff",
                border: "1px dashed #d8e1d4",
                borderRadius: "14px",
                color: "#687a6d",
              }}
            >
              <Icon name="folder" size={32} style={{ marginBottom: "8px" }} />
              <p style={{ margin: 0, fontSize: "14px" }}>
                This playlist currently has no visible prompts.
              </p>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {items.map((item) => {
                const data = (item.data || {}) as { task?: string };
                return (
                  <Link
                    key={item.id}
                    href={`/p/${item.publicId}?c=${collection.publicId}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "16px",
                      padding: "18px 20px",
                      background: "#fff",
                      border: "1px solid #dfe8db",
                      borderRadius: "14px",
                      textDecoration: "none",
                      color: "inherit",
                      transition:
                        "transform 0.1s ease, border-color 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        minWidth: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "#e8f5d6",
                        color: "#246a48",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "13px",
                        fontWeight: 800,
                      }}
                    >
                      {String(item.rank).padStart(2, "0")}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "#1c3929",
                          marginBottom: "4px",
                        }}
                      >
                        {item.title}
                      </div>
                      {data.task && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            color: "#566860",
                            lineHeight: 1.4,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {data.task}
                        </p>
                      )}
                      {item.tags && item.tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                            marginTop: "8px",
                          }}
                        >
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: "11px",
                                padding: "2px 8px",
                                background: "#f2f7ef",
                                borderRadius: "12px",
                                color: "#416d45",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        color: "#246a48",
                        fontSize: "13px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        marginTop: "4px",
                      }}
                    >
                      <span>Open</span>
                      <Icon name="arrow-right" size={14} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
