import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteUpdates } from "@/lib/server/public-data";
import { publicMetadata } from "@/lib/seo/public-metadata";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const item = (await siteUpdates()).find((update) => update.id === id);
  if (!item) return { title: "Update unavailable", robots: { index: false } };
  return publicMetadata(item.title, item.summary, `/updates/${item.id}`);
}

export default async function UpdatePage({ params }: Props) {
  const id = (await params).id;
  const item = (await siteUpdates()).find((update) => update.id === id);
  if (!item) notFound();
  return (
    <div className="updates-page-body">
      <main className="updates-page">
        <header className="updates-page-header">
          <Link className="updates-page-brand" href="/">
            ✳ prompt<span>dock</span>
          </Link>
          <Link className="updates-page-back" href="/updates">
            ← All updates
          </Link>
        </header>
        <article className="react-update-detail">
          <span className="section-kicker">
            {item.version} · {item.date}
          </span>
          <h1>{item.title}</h1>
          <p className="react-update-summary">{item.summary}</p>
          {item.body.split(/\n\s*\n/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </main>
    </div>
  );
}
