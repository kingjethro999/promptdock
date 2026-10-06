import Link from "next/link";
import { siteUpdates } from "@/lib/server/public-data";
import UpdatesList from "@/components/updates/UpdatesList";
import { publicMetadata } from "@/lib/seo/public-metadata";

export const metadata = {
  ...publicMetadata(
    "Updates",
    "PromptDock product updates and announcements.",
    "/updates",
  ),
  alternates: {
    canonical: "/updates",
    types: { "application/rss+xml": "/feed.xml" },
  },
};
export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const updates = await siteUpdates();
  return (
    <div className="updates-page-body">
      <main className="updates-page">
        <header className="updates-page-header">
          <Link className="updates-page-brand" href="/">
            <span className="updates-page-brand-mark">✳</span> prompt
            <span>dock</span>
          </Link>
          <Link className="updates-page-back" href="/">
            ← Back to PromptDock
          </Link>
        </header>
        <section className="updates-page-intro">
          <span className="landing-kicker">FROM THE BUILDER</span>
          <h1>What’s new in PromptDock.</h1>
          <p>
            Short notes from King Jethro about what is shipping, what is coming
            next, and how PromptDock is growing.
          </p>
        </section>
        <UpdatesList updates={updates} />
        <footer className="updates-page-footer">
          Built in the open source community by{" "}
          <a href="https://github.com/kingjethro999">King Jethro</a>.
        </footer>
      </main>
    </div>
  );
}
