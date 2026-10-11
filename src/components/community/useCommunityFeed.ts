"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  Page,
  CommunityPromptCard as CardType,
} from "@/lib/community/types";

export type FeedStatus = "idle" | "loading" | "error" | "rate_limited";

export function useCommunityFeed(initial: Page | null, key: string) {
  const [state, setState] = useState<{
    items: CardType[];
    cursor: string | null;
    status: FeedStatus;
  }>({
    items: initial?.items ?? [],
    cursor: initial?.nextCursor ?? null,
    status: initial ? "idle" : "loading",
  });
  const [retry, setRetry] = useState(0);
  const loadedKey = useRef<string | null>(initial ? key : null);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (loadedKey.current === key && retry === 0) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const url = `/api/community/prompts${key ? `?${key}` : ""}`;
        const res = await fetch(url, { signal: ctl.signal });
        if (res.status === 429) {
          setState((s) => ({ ...s, status: "rate_limited" }));
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const page: Page = await res.json();
        loadedKey.current = key;
        setState({
          items: page.items,
          cursor: page.nextCursor,
          status: "idle",
        });
      } catch {
        if (!ctl.signal.aborted) {
          setState((s) => ({ ...s, status: "error" }));
        }
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [key, retry]);

  const loadMore = useCallback(async () => {
    if (!state.cursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const q = new URLSearchParams(key);
      q.set("cursor", state.cursor);
      const res = await fetch(`/api/community/prompts?${q.toString()}`);
      if (!res.ok) return;
      const page: Page = await res.json();
      setState((s) => ({
        items: [...s.items, ...page.items],
        cursor: page.nextCursor,
        status: "idle",
      }));
    } finally {
      loadingMore.current = false;
    }
  }, [key, state.cursor]);

  return {
    items: state.items,
    cursor: state.cursor,
    status: state.status,
    loadMore,
    retry: () => setRetry((n) => n + 1),
  };
}
