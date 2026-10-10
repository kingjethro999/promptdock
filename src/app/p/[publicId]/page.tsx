import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { database } from "@/server/database";
import { clean } from "@/lib/og/text";
import { buildPrompt } from "@/lib/prompt/format";
import ShareActions from "@/components/share/ShareActions";
import { sharedPromptStructuredData } from "@/lib/seo/structured-data";

const getPrompt = cache((id: string) => database.getPublicPrompt(id));

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const prompt = await getPrompt(publicId).catch(() => null);
  if (!prompt) {
    return { title: "Shared prompt", robots: { index: false } };
  }

  const owner = clean(prompt.ownerUsername, 40);
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

export default async function SharedPromptPage({ params }: Props) {
  const { publicId } = await params;
  const item = await getPrompt(publicId).catch(() => null);
  if (!item) notFound();

  const prompt = buildPrompt(item.data);
  const owner = item.ownerUsername || "A PromptDock member";
  const origin = (
    process.env.APP_URL || "https://thepromptdock.vercel.app"
  ).replace(/\/$/, "");
  const structuredData = sharedPromptStructuredData({
    origin,
    publicId: item.publicId,
    name: item.name,
    description: clean(item.data?.task || "A shared PromptDock prompt", 180),
    ownerUsername: item.ownerUsername,
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
          <span>✳</span> prompt<em>dock</em>
        </Link>
        <Link href="/workspace" className="shared-home-link">
          Create your own prompt ↗
        </Link>
      </header>
      <main className="shared-main">
        <div className="shared-topline">
          <span>✳ PUBLIC PROMPT</span>
          <span>View and copy freely</span>
        </div>
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
            ✳
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
            <div className="shared-side-icon">↗</div>
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
        <span>✳ promptdock</span>
        <nav>
          <Link href="/">Start with your idea ↗</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/copyright">Copyright</Link>
        </nav>
      </footer>
    </div>
  );
}
