"use client";

import Link from "next/link";
import { useState } from "react";

export default function PublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="public-shell"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <header className="community-public-header">
        <div className="community-public-header-inner">
          <div className="community-public-header-left">
            <Link
              className="community-nav-brand"
              href="/"
              aria-label="PromptDock home"
            >
              <span className="community-nav-logo-mark" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M5 7h17a6 6 0 0 1 0 12h-8v7L5 19V7Z"
                    fill="#182824"
                  />
                  <circle cx="14" cy="13" r="1.6" fill="#d7f477" />
                  <circle cx="21" cy="13" r="1.6" fill="#d7f477" />
                </svg>
              </span>
              <span className="community-nav-brand-text">
                prompt<span className="community-nav-brand-accent">dock</span>
              </span>
            </Link>

            <nav
              className="community-nav-links"
              aria-label="Community navigation"
            >
              <Link href="/community" className="community-nav-link active">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                <span>Community</span>
              </Link>
            </nav>
          </div>

          <div className="community-public-header-right">
            <Link
              href="/auth?mode=login&next=/community"
              className="community-nav-signin"
            >
              Sign in
            </Link>
            <Link href="/workspace" className="community-nav-cta">
              <span>New Prompt</span>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>

            <button
              type="button"
              className="community-nav-mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="community-mobile-drawer">
          <Link
            href="/community"
            onClick={() => setMobileMenuOpen(false)}
            className="community-mobile-link active"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span>Community Feed</span>
          </Link>
          <div className="community-mobile-divider" />
          <Link
            href="/auth?mode=login&next=/community"
            onClick={() => setMobileMenuOpen(false)}
            className="community-mobile-link"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span>Sign in</span>
          </Link>
          <Link
            href="/workspace"
            onClick={() => setMobileMenuOpen(false)}
            className="community-mobile-link"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create Prompt</span>
          </Link>
        </div>
      )}

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

      <footer className="community-public-footer">
        <div className="community-public-footer-inner">
          <div className="community-public-footer-brand">
            <span style={{ color: "#7ea747" }}>✳</span>
            <span>promptdock</span>
          </div>
          <nav
            className="community-public-footer-links"
            aria-label="Footer navigation"
          >
            <Link href="/community">Community</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/copyright">Copyright</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
