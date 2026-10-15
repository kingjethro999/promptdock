"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui";
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
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fb =
                  e.currentTarget.parentElement?.querySelector<HTMLElement>(
                    ".community-avatar-fallback",
                  );
                if (fb) fb.style.display = "inline-flex";
              }}
            />
          ) : null}
          <span
            className="community-avatar-small community-avatar-fallback"
            data-tone={fallback.tone}
            style={{
              display: card.creator.avatarUrl ? "none" : "inline-flex",
            }}
            aria-hidden="true"
          >
            {fallback.letter}
          </span>
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
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={copied ? "check" : "copy"}
          onClick={handleCopy}
          aria-label="Copy prompt text"
        >
          {copied ? "Copied" : "Copy"}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leadingIcon="bookmark"
          onClick={handleSave}
          disabled={saving}
          aria-label="Save prompt to your library"
        >
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </Button>

        <LinkButton
          href={`/workspace?remix=${card.publicId}`}
          variant="primary"
          size="sm"
          leadingIcon="zap"
          style={{ marginLeft: "auto" }}
          aria-label="Remix this prompt"
        >
          Remix
        </LinkButton>
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
