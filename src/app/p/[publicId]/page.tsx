import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPromptForViewer } from "@/lib/community/queries";
import { getViewer } from "@/lib/community/viewer";
import { clean } from "@/lib/og/text";
import { buildPrompt } from "@/lib/prompt/format";
import type { PromptData } from "@/lib/prompt/types";
import ShareActions from "@/components/share/ShareActions";
import { Glyph, Icon } from "@/components/ui";
import { sharedPromptStructuredData } from "@/lib/seo/structured-data";
import { getSeriesContext } from "@/lib/community/collections";

const getPrompt = cache((id: string, viewerId: string | null) =>
  getPromptForViewer(id, viewerId),
);

type Props = {
  params: Promise<{ publicId: string }>;
  searchParams?: Promise<{ c?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const prompt = await getPrompt(publicId, null).catch(() => null);
  if (!prompt) {
    return { title: "Shared prompt", robots: { index: false } };
  }

  const owner = clean(prompt.displayName || prompt.username, 40);
  const title = owner
    ? `${owner} wants to share a prompt with you`
    : `${clean(prompt.name, 90)}`;
  const description = clean(
    prompt.data?.task || "A shared PromptDock prompt",
    180,
  );
  const image = `/api/og/p/${publicId}?v=${new Date(prompt.updatedAt ?? 0).getTime()}`;

  return {
    title,
    description,
    alternates: { canonical: `/p/${publicId}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/p/${publicId}`,
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

export default async function SharedPromptPage({
  params,
  searchParams,
}: Props) {
  const { publicId } = await params;
  const sp = searchParams ? await searchParams : {};
  const collectionPublicId = sp.c || null;
  const viewer = await getViewer();
  const item = await getPrompt(publicId, viewer?.id ?? null).catch(() => null);
  if (!item) notFound();

  const seriesContext = collectionPublicId
    ? await getSeriesContext(collectionPublicId, publicId, viewer?.id ?? null)
    : null;

  const prompt = buildPrompt(item.data as unknown as PromptData);
  const owner = item.displayName || item.username || "A PromptDock member";
  const origin = (
    process.env.APP_URL || "https://thepromptdock.vercel.app"
  ).replace(/\/$/, "");
  const structuredData = sharedPromptStructuredData({
    origin,
    publicId: item.publicId,
    name: item.name,
    description: clean(item.data?.task || "A shared PromptDock prompt", 180),
    ownerUsername: item.username,
    updatedAt: item.updatedAt,
  });

  return (
    <div className="shared-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
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
      <main className="shared-main">
        <div className="shared-topline">
          <span>
            <Glyph name="spark" size={12} /> PUBLIC PROMPT
          </span>
          <span>View and copy freely</span>
        </div>
        {seriesContext && (
          <div className="shared-series-banner">
            <div className="shared-series-info">
              <Link
                href={`/c/${seriesContext.collection.publicId}`}
                className="shared-series-back"
              >
                <Icon name="chevron-left" size={14} /> Playlist
              </Link>
              <span className="shared-series-pill">
                Part {seriesContext.rank} of {seriesContext.total} in{" "}
                <Link
                  href={`/c/${seriesContext.collection.publicId}`}
                  className="shared-series-title"
                >
                  {seriesContext.collection.name}
                </Link>
              </span>
            </div>
            <div className="shared-series-nav">
              {seriesContext.prevPublicId ? (
                <Link
                  href={`/p/${seriesContext.prevPublicId}?c=${seriesContext.collection.publicId}`}
                  className="ui-btn ui-btn--sm"
                >
                  <Icon name="chevron-left" size={13} /> Prev
                </Link>
              ) : (
                <span
                  className="ui-btn ui-btn--sm"
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                >
                  <Icon name="chevron-left" size={13} /> Prev
                </span>
              )}
              {seriesContext.nextPublicId ? (
                <Link
                  href={`/p/${seriesContext.nextPublicId}?c=${seriesContext.collection.publicId}`}
                  className="ui-btn ui-btn--sm ui-btn--primary"
                >
                  Next <Icon name="chevron-right" size={13} />
                </Link>
              ) : (
                <span
                  className="ui-btn ui-btn--sm"
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                >
                  Next <Icon name="chevron-right" size={13} />
                </span>
              )}
            </div>
          </div>
        )}
        <section className="shared-hero">
          <div>
            <div className="shared-eyebrow">A CLEARER WAY TO ASK</div>
            <h1>{item.name}</h1>
            <p>
              {owner} shared a prompt with you. Copy it into your AI platform or
              save a copy to your own library.
            </p>
            <div className="shared-meta">
              <span>{item.data.depth || "Prompt"}</span>
              <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="shared-symbol" aria-hidden="true">
            <Glyph name="spark" size={32} />
          </div>
        </section>
        <section className="shared-content">
          <div className="shared-prompt-card">
            <div className="shared-card-head">
              <span>THE PROMPT</span>
              <span>READY FOR ANY AI</span>
            </div>
            <pre tabIndex={0}>{prompt}</pre>
            <ShareActions prompt={prompt} publicId={item.publicId} />
          </div>
          <aside className="shared-side">
            <div className="shared-side-icon">
              <Glyph name="arrow-up-right" size={24} />
            </div>
            <h2>Make it yours.</h2>
            <p>
              Copy this prompt into an AI platform. Sign in to keep a separate
              copy in your library and edit it.
            </p>
            <div className="shared-rule" />
            <span>SHARING ON PROMPTDOCK</span>
            <p>
              The owner can make this link private at any time. A copy you save
              stays yours.
            </p>
          </aside>
        </section>
      </main>
      <footer className="shared-footer">
        <span>
          <Glyph name="spark" size={14} /> promptdock
        </span>
        <nav>
          <Link href="/">
            Start with your idea{" "}
            <Icon
              name="arrow-up-right"
              size={13}
              style={{ display: "inline-block", verticalAlign: "middle" }}
            />
          </Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/copyright">Copyright</Link>
        </nav>
      </footer>
    </div>
  );
}
