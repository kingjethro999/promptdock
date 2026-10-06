import Link from "next/link";
import type { ReactNode } from "react";
import type { ReleaseForm } from "./AdminUpdateComposer";

export type Analytics = {
  users: number;
  verified_users: number;
  saved_prompts: number;
  feedback: number;
  updates: number;
};
export type Feedback = {
  id: string;
  kind: string;
  message: string;
  contactEmail: string | null;
  createdAt: string;
};
export type Update = ReleaseForm & { publishedAt?: string | null };

type Props = {
  analytics: Analytics | null;
  feedback: Feedback[];
  updates: Update[];
  form: ReleaseForm;
  onRemove(id: string): void;
  confirmingRemoveId: string;
  children: ReactNode;
};

export default function AdminDashboard({
  analytics,
  feedback,
  updates,
  form,
  onRemove,
  confirmingRemoveId,
  children,
}: Props) {
  const stats = [
    "users",
    "verified_users",
    "saved_prompts",
    "feedback",
    "updates",
  ] as const;
  return (
    <div className="admin-page-body">
      <div className="admin-shell">
        <aside className="admin-rail" aria-label="Admin navigation">
          <Link href="/workspace" className="admin-brand">
            <span className="admin-brand-mark" aria-hidden="true">
              ✳
            </span>
            <span>
              prompt<em>dock</em>
              <small>PROJECT STUDIO</small>
            </span>
          </Link>
          <div className="admin-rail-label">YOUR SPACE</div>
          <nav className="admin-nav">
            <a href="#overview">
              <span>▦</span> Overview
            </a>
            <a href="#publish">
              <span>✳</span> Publish updates
            </a>
            <a href="#feedback">
              <span>✉</span> Feedback
            </a>
          </nav>
          <div className="admin-rail-bottom">
            <p>
              Only site-wide counts and submitted feedback appear here. Your
              users&apos; private ideas stay private.
            </p>
            <Link href="/workspace">← Back to workspace</Link>
          </div>
        </aside>
        <main className="admin-page">
          <header className="admin-topbar">
            <span className="admin-breadcrumb">
              Workspace <span>/</span> Admin
            </span>
            <Link href="/updates">
              View public updates <span aria-hidden="true">↗</span>
            </Link>
          </header>
          <section className="admin-hero" id="overview">
            <div>
              <span className="admin-eyebrow">
                <span className="admin-live-dot" /> PROMPTDOCK CONTROL ROOM
              </span>
              <h1>
                Shape what comes <em>next.</em>
              </h1>
              <p>
                See the pulse of the project, listen to users, and share what
                you&apos;ve shipped.
              </p>
            </div>
            <div className="admin-hero-art" aria-hidden="true">
              <span>✳</span>
              <span>✦</span>
              <span>✳</span>
            </div>
          </section>
          <section
            className="admin-section"
            aria-labelledby="adminOverviewHeading"
          >
            <div className="admin-section-head">
              <div>
                <span className="admin-eyebrow">AT A GLANCE</span>
                <h2 id="adminOverviewHeading">Project overview</h2>
              </div>
              <span className="admin-section-note">Aggregate counts only</span>
            </div>
            <div className="admin-stats">
              {stats.map((key) => (
                <div className="admin-stat" key={key}>
                  <strong>{analytics?.[key] ?? "—"}</strong>
                  <span>{key.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="admin-grid">
            {children}
            <aside className="admin-side-stack">
              <section
                className="admin-preview"
                aria-labelledby="adminPreviewHeading"
              >
                <span className="admin-eyebrow">LIVE PREVIEW</span>
                <h2 id="adminPreviewHeading">How it will read</h2>
                <div className="admin-preview-card">
                  <span>
                    {form.version || "VERSION"} · {form.date || "DATE"}
                  </span>
                  <h3>{form.title || "Your update headline"}</h3>
                  <p>
                    {form.summary ||
                      "The short summary will appear here as you write."}
                  </p>
                </div>
              </section>
              <section className="admin-preview admin-managed">
                <span className="admin-eyebrow">RELEASE LIBRARY</span>
                <h2>Published updates</h2>
                <div className="admin-published-list">
                  {updates.some((item) => item.publishedAt) ? (
                    updates
                      .filter((item) => item.publishedAt)
                      .map((item) => (
                        <div className="admin-published-item" key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.version}</small>
                          </div>
                          <button
                            type="button"
                            className={
                              confirmingRemoveId === item.id
                                ? "is-confirming"
                                : undefined
                            }
                            aria-label={`Remove ${item.title}`}
                            onClick={() => onRemove(item.id)}
                          >
                            {confirmingRemoveId === item.id
                              ? "Confirm?"
                              : "Remove"}
                          </button>
                        </div>
                      ))
                  ) : (
                    <p className="admin-muted">
                      Updates you publish will appear here.
                    </p>
                  )}
                </div>
              </section>
              <section className="admin-privacy-note">
                <span aria-hidden="true">◈</span>
                <div>
                  <strong>Built for trust</strong>
                  <p>
                    This console shows aggregate activity and messages users
                    chose to send. It does not expose private prompts or idea
                    inputs.
                  </p>
                </div>
              </section>
            </aside>
          </div>
          <section
            className="admin-panel admin-inbox"
            id="feedback"
            aria-labelledby="adminFeedbackHeading"
          >
            <div className="admin-section-head">
              <div>
                <span className="admin-eyebrow">FROM THE COMMUNITY</span>
                <h2 id="adminFeedbackHeading">Feedback inbox</h2>
              </div>
              <span className="admin-count">{feedback.length} reports</span>
            </div>
            <p className="admin-muted">
              Reports and ideas submitted by users. Reply to a contact email
              when one was provided.
            </p>
            <div className="admin-feedback-list">
              {feedback.length ? (
                feedback.map((item) => (
                  <article className="admin-feedback-item" key={item.id}>
                    <strong>{item.kind}</strong>
                    <p>{item.message}</p>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                    {item.contactEmail && (
                      <p>
                        <a href={`mailto:${item.contactEmail}`}>
                          {item.contactEmail}
                        </a>
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p className="admin-muted">No feedback yet.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
