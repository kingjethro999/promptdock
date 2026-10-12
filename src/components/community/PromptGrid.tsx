"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import type { Page } from "@/lib/community/types";
import { canonicalKey, type Sort } from "@/lib/community/filters";
import { useCommunityFeed } from "./useCommunityFeed";
import CommunityPromptCard from "./CommunityPromptCard";

export default function PromptGrid({
  initial,
  creatorId,
  showFilters = true,
  availableTags = [],
}: {
  initial: Page;
  creatorId?: string;
  showFilters?: boolean;
  availableTags?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const qParam = searchParams.get("q") ?? "";
  const sortParam = (searchParams.get("sort") as Sort) || "new";
  const selectedTags = useMemo(
    () => searchParams.getAll("tag").filter(Boolean),
    [searchParams],
  );

  const [draftQ, setDraftQ] = useState(qParam);
  useEffect(() => {
    if (draftQ !== qParam) setDraftQ(qParam);
  }, [qParam]);

  useEffect(() => {
    if (draftQ === qParam) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString());
      if (draftQ.trim()) {
        sp.set("q", draftQ.trim());
      } else {
        sp.delete("q");
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [draftQ, qParam, pathname, router, searchParams]);

  const filterKey = useMemo(() => {
    const sp = new URLSearchParams(searchParams.toString());
    if (creatorId) sp.set("creatorId", creatorId);
    return canonicalKey(sp);
  }, [searchParams, creatorId]);

  const { items, cursor, status, loadMore, retry } = useCommunityFeed(
    initial,
    filterKey,
  );

  function handleSortChange(nextSort: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (nextSort === "new") sp.delete("sort");
    else sp.set("sort", nextSort);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function toggleTag(tag: string) {
    const sp = new URLSearchParams(searchParams.toString());
    const existing = sp.getAll("tag");
    sp.delete("tag");
    if (existing.includes(tag)) {
      existing.filter((t) => t !== tag).forEach((t) => sp.append("tag", t));
    } else {
      [...existing, tag].forEach((t) => sp.append("tag", t));
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  function clearFilters() {
    setDraftQ("");
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("q");
    sp.delete("tag");
    sp.delete("sort");
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const hasActiveFilters = Boolean(qParam.trim() || selectedTags.length > 0);

  return (
    <div>
      {showFilters && (
        <div className="community-filters">
          <input
            type="search"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Search prompts by title, keywords or @creator…"
            className="community-search-input"
            aria-label="Search prompts"
          />

          <select
            value={sortParam}
            onChange={(e) => handleSortChange(e.target.value)}
            className="community-sort-select"
            aria-label="Sort prompts"
          >
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
          </select>
        </div>
      )}

      {showFilters && availableTags.length > 0 && (
        <div className="community-tags-bar" aria-label="Filter by tag">
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`community-tag-chip ${active ? "active" : ""}`}
                aria-pressed={active}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      {status === "loading" && items.length === 0 ? (
        <div className="community-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="community-card-skeleton" />
          ))}
        </div>
      ) : status === "rate_limited" ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">✳</div>
          <h3>Too many requests</h3>
          <p>
            You’ve reached the hourly rate limit for exploring prompts. Please
            take a breath and try again shortly.
          </p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : status === "error" ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">✳</div>
          <h3>Could not load community prompts</h3>
          <p>
            We had trouble reaching the server. Please check your connection and
            try again.
          </p>
          <Button variant="primary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✳</div>
          <h3>
            {hasActiveFilters
              ? "No matching prompts found"
              : "No community prompts yet"}
          </h3>
          <p>
            {hasActiveFilters
              ? "Try adjusting your search terms or clearing your selected filters."
              : "Be the first creator to share an inspiring prompt with the PromptDock community."}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Link href="/workspace">
              <Button variant="primary">Create a prompt ↗</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="community-grid">
          {items.map((card) => (
            <CommunityPromptCard key={card.publicId} card={card} />
          ))}
        </div>
      )}

      {cursor && status !== "error" && status !== "rate_limited" && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Button
            variant="secondary"
            onClick={loadMore}
            disabled={status === "loading"}
            style={{ minWidth: 160, minHeight: 44 }}
          >
            {status === "loading" ? "Loading more…" : "Load more prompts"}
          </Button>
        </div>
      )}
    </div>
  );
}
