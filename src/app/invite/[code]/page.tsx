import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const referrals = require("../../../referrals") as {
  inviterFor(code: string): Promise<{ username: string | null } | null>;
};
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = (await params).code;
  const inviter = await referrals.inviterFor(code).catch(() => null);
  if (!inviter)
    return { title: "Invitation unavailable", robots: { index: false } };
  const name = inviter.username || "A PromptDock member";
  const title = `${name} invited you to PromptDock`;
  const description =
    "Turn rough ideas into prompts worth keeping. Create a free workspace, save what works, and share it with others.";
  return {
    title,
    description,
    alternates: { canonical: `/invite/${code}` },
    robots: { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `/invite/${code}`,
      images: [
        {
          url: "/social-card.png",
          width: 1200,
          height: 630,
          alt: "PromptDock — Good ideas deserve a clearer prompt",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/social-card.png"],
    },
  };
}

export default async function InvitePage({ params }: Props) {
  const code = (await params).code;
  const inviter = await referrals.inviterFor(code).catch(() => null);
  if (!inviter) notFound();
  const name = inviter.username || "A PromptDock member";
  return (
    <div className="react-invite-page">
      <header>
        <Link href="/" className="landing-logo">
          ✳ prompt<span>dock</span>
        </Link>
        <Link href="/auth?mode=login">Sign in</Link>
      </header>
      <main>
        <span className="section-kicker">YOU’RE INVITED</span>
        <h1>{name} invited you to PromptDock.</h1>
        <p>
          Bring a rough idea, a voice note, or an image reference. PromptDock
          helps you shape it into a clear prompt for the AI platform you choose.
        </p>
        <Link
          className="landing-primary-cta"
          href={`/auth?mode=register&ref=${encodeURIComponent(code)}`}
        >
          Create your workspace ↗
        </Link>
        <p>
          Already have an account? <Link href="/auth?mode=login">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
