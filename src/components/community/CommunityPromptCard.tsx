"use client";

import Link from "next/link";
import { useState } from "react";
import type { CommunityPromptCard as CardType } from "@/lib/community/types";
import { avatarFallback } from "@/lib/community/username";
import { copyPromptText } from "@/lib/community/copy";

export default function CommunityPromptCard({ card }: { card: CardType }) {
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fallback = avatarFallback(card.creator.username);

  async function handleCopy() {
    const ok = await copyPromptText(card.publicId);
    if (ok) {
      setCopied(true);
      setCopyFeedback("Prompt copied to clipboard");
      setTimeout(() => {
        setCopied(false);
        setCopyFeedback("");
      }, 2000);
    } else {
      setCopyFeedback("Failed to copy prompt");
      setTimeout(() => setCopyFeedback(""), 2000);
    }
  }

  async function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/community/prompts/${card.publicId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: "save" }),
      });

      if (res.status === 401) {
        window.location.href = `/auth?mode=login&next=/community`;
        return;
      }

      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // ignore transient error
    } finally {
      setSaving(false);
    }
  }

  const dateFormatted = card.listedAt
    ? new Date(card.listedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <article className="community-card">
      <div className="community-card-header">
        <Link
          href={`/${card.creator.username}`}
          className="community-card-creator"
        >
          {card.creator.avatarUrl ? (
            <img
              src={card.creator.avatarUrl}
              alt=""
              className="community-avatar-small"
            />
          ) : (
            <span
              className="community-avatar-small"
              data-tone={fallback.tone}
              aria-hidden="true"
            >
              {fallback.letter}
            </span>
          )}
          <div className="community-creator-info">
            <span className="community-creator-name">
              {card.creator.displayName}
            </span>
            <span className="community-creator-handle">
              @{card.creator.username}
            </span>
          </div>
        </Link>
        {dateFormatted && (
          <time
            dateTime={card.listedAt}
            style={{ fontSize: 12, color: "var(--community-muted)" }}
          >
            {dateFormatted}
          </time>
        )}
      </div>

      <h3 className="community-card-title">
        <Link href={`/p/${card.publicId}`}>{card.title}</Link>
      </h3>

      <div className="community-card-excerpt">{card.excerpt}</div>

      {card.tags && card.tags.length > 0 && (
        <div className="community-card-tags">
          {card.tags.map((tag) => (
            <span key={tag} className="community-card-tag">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="community-card-actions">
        <button
          type="button"
          onClick={handleCopy}
          className="community-btn"
          aria-label="Copy prompt text"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="community-btn"
          aria-label="Save prompt to your library"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
          <span>{saved ? "Saved" : saving ? "Saving…" : "Save"}</span>
        </button>

        <Link
          href={`/workspace?remix=${card.publicId}`}
          className="community-btn community-btn-primary"
          style={{ marginLeft: "auto" }}
          aria-label="Remix this prompt"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>Remix</span>
        </Link>
      </div>

      <div
        className="sr-only"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          border: 0,
        }}
      >
        {copyFeedback}
      </div>
    </article>
  );
}
