"use client";

import { useState } from "react";
import type { ResearchMetadata } from "@/lib/prompt/types";

function extractHostname(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

export default function ResearchDrawer({
  research,
}: {
  research?: ResearchMetadata;
}) {
  const [open, setOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!research) return null;

  const hasSources = Boolean(research.used && research.sources?.length);
  const hasFallback = Boolean(
    research.attempted && !research.used && research.fallbackReason,
  );

  if (!hasSources && !hasFallback) return null;

  async function copySource(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // ignore clipboard write failure
    }
  }

  return (
    <div className="research-drawer-container">
      {hasSources && (
        <div className="research-drawer">
          <div className="research-drawer-header">
            <button
              type="button"
              className="research-drawer-toggle"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              <span className="research-badge-icon" aria-hidden="true">
                ✳
              </span>
              <span className="research-badge-label">
                Research Grounding · {research.sources.length}{" "}
                {research.sources.length === 1 ? "source" : "sources"}
              </span>
              <span className="research-toggle-arrow" aria-hidden="true">
                {open ? "▴ Hide" : "▾ View sources"}
              </span>
            </button>
          </div>

          {open && (
            <div className="research-sources-content">
              {research.queries && research.queries.length > 0 && (
                <div className="research-queries-row">
                  <span className="research-queries-label">Searched:</span>
                  {research.queries.map((q, idx) => (
                    <span key={idx} className="research-query-pill">
                      &ldquo;{q}&rdquo;
                    </span>
                  ))}
                </div>
              )}

              <div className="research-sources-list">
                {research.sources.map((source, index) => {
                  const host = extractHostname(source.url);
                  return (
                    <div
                      key={source.url + index}
                      className="research-source-card"
                    >
                      <div className="research-source-top">
                        <span className="research-host-badge">{host}</span>
                        {source.publishedAt && (
                          <span className="research-date-badge">
                            {source.publishedAt}
                          </span>
                        )}
                        <button
                          type="button"
                          className="research-copy-link"
                          onClick={() => copySource(source.url)}
                          title="Copy source URL"
                        >
                          {copiedUrl === source.url ? "✓ Copied" : "Copy URL"}
                        </button>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="research-source-title"
                      >
                        {source.title || host}
                        <span className="source-external-arrow"> ↗</span>
                      </a>
                      {source.description && (
                        <p className="research-source-snippet">
                          {source.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasFallback && (
        <div className="research-fallback-card" role="status">
          <span className="research-fallback-icon" aria-hidden="true">
            ℹ
          </span>
          <span className="research-fallback-text">
            {research.fallbackReason} Prompt shaped with offline model
            knowledge.
          </span>
        </div>
      )}
    </div>
  );
}
