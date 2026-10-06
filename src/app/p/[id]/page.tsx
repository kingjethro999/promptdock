import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicPrompt } from "@/lib/server/public-data";
import { buildPrompt } from "@/lib/prompt/format";
import ShareActions from "@/components/share/ShareActions";
import { sharedPromptStructuredData } from "@/lib/seo/structured-data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await publicPrompt((await params).id);
  if (!item)
    return { title: "Shared prompt unavailable", robots: { index: false } };
  const owner = item.ownerUsername || "A PromptDock member";
  const title = item.ownerUsername
    ? `${owner} wants to share a prompt with you`
    : `${item.name} — PromptDock`;
  const description = String(item.data?.task || "A shared PromptDock prompt")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return {
    title,
    description,
    alternates: { canonical: `/p/${item.publicId}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/p/${item.publicId}`,
      images: [{ url: "/social-card.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/social-card.png"],
    },
  };
}

export default async function SharedPromptPage({ params }: Props) {
  const item = await publicPrompt((await params).id);
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
    description: String(item.data?.task || "A shared PromptDock prompt")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
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
