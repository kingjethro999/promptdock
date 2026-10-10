import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { clean } from "@/lib/og/text";
import { referrals } from "@/server/referrals";

const getInviter = cache((code: string) => referrals.inviterFor(code));

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const inviter = await getInviter(code).catch(() => null);
  if (!inviter || !inviter.username) {
    return { title: "Invitation unavailable", robots: { index: false } };
  }

  const name = clean(inviter.username, 40);
  const title = `${name} invited you to PromptDock`;
  const description =
    "Turn rough ideas into prompts worth keeping. Create a free workspace, save what works, and share it with others.";
  const image = `/api/og/invite/${clean(code, 24)}`;

  return {
    title,
    description,
    alternates: { canonical: `/invite/${code}` },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/invite/${code}`,
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

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const inviter = await getInviter(code).catch(() => null);
  if (!inviter || !inviter.username) notFound();
  const name = clean(inviter.username, 40);

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
