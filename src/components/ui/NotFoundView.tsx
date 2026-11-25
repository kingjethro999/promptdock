import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The page people see when something is missing or not theirs to open.
 * One primary action, one quiet one, and plain words about why.
 */
export default function NotFoundView({
  code = "404",
  title,
  children,
  primary,
  secondary,
}: {
  code?: string;
  title: string;
  children: ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <main className="nf-page">
      <Link className="nf-brand" href="/" aria-label="PromptDock home">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="18" fill="#182824" />
          <path d="M16 20h25a9 9 0 0 1 0 18H29v10l-13-10V20Z" fill="#c7f464" />
          <circle cx="29" cy="29" r="3" fill="#182824" />
          <circle cx="40" cy="29" r="3" fill="#182824" />
        </svg>
        <span>
          prompt<em>dock</em>
        </span>
      </Link>
      <section className="nf-card">
        <span className="nf-code" aria-hidden="true">
          {code}
        </span>
        <h1>{title}</h1>
        <div className="nf-body">{children}</div>
        <div className="nf-actions">
          <Link className="nf-primary" href={primary.href}>
            {primary.label}
          </Link>
          {secondary && (
            <Link className="nf-quiet" href={secondary.href}>
              {secondary.label}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
