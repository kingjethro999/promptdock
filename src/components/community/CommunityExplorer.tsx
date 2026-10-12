"use client";

import { useState } from "react";
import type { Page, CommunityCreatorCard } from "@/lib/community/types";
import PromptGrid from "./PromptGrid";
import CreatorGrid from "./CreatorGrid";

type Props = {
  initialPrompts: Page;
  availableTags: string[];
  initialCreators: CommunityCreatorCard[];
};

export default function CommunityExplorer({
  initialPrompts,
  availableTags,
  initialCreators,
}: Props) {
  const [activeTab, setActiveTab] = useState<"prompts" | "creators">("prompts");

  return (
    <div className="community-explorer">
      {/* Tabs */}
      <div
        className="community-tabs"
        role="tablist"
        aria-label="Community navigation"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "prompts"}
          className={`community-tab-btn ${activeTab === "prompts" ? "active" : ""}`}
          onClick={() => setActiveTab("prompts")}
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Prompts</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "creators"}
          className={`community-tab-btn ${activeTab === "creators" ? "active" : ""}`}
          onClick={() => setActiveTab("creators")}
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Creators</span>
          {initialCreators.length > 0 && (
            <span className="community-tab-count">
              {initialCreators.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "prompts" ? (
        <PromptGrid
          initial={initialPrompts}
          availableTags={availableTags}
          showFilters={true}
        />
      ) : (
        <CreatorGrid initialCreators={initialCreators} />
      )}
    </div>
  );
}
