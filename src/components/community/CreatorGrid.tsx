"use client";

import { useState, useEffect } from "react";
import type { CommunityCreatorCard } from "@/lib/community/types";
import CreatorCard from "./CreatorCard";

type Props = {
  initialCreators?: CommunityCreatorCard[];
};

export default function CreatorGrid({ initialCreators = [] }: Props) {
  const [creators, setCreators] =
    useState<CommunityCreatorCard[]>(initialCreators);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/community/creators?q=${encodeURIComponent(q)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setCreators(data.items || []);
        }
      } catch {
        // ignore fetch error
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="community-creators-view">
      <div className="community-filters">
        <input
          type="search"
          className="community-search-input"
          placeholder="Search creators by name, handle, or bio..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search creators"
        />
      </div>

      {loading && creators.length === 0 ? (
        <div className="community-feed-loading">
          <p>Finding creators…</p>
        </div>
      ) : creators.length === 0 ? (
        <div className="community-empty">
          <h3>No creators found</h3>
          <p>Try searching for a different name, handle, or keyword.</p>
        </div>
      ) : (
        <div className="creators-grid">
          {creators.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
        </div>
      )}
    </div>
  );
}
