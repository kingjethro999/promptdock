"use client";

import { useState } from "react";
import type { Page, CommunityCreatorCard } from "@/lib/community/types";
import { Icon } from "@/components/ui";
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
          <Icon name="file" size={16} />
          <span>Prompts</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "creators"}
          className={`community-tab-btn ${activeTab === "creators" ? "active" : ""}`}
          onClick={() => setActiveTab("creators")}
        >
          <Icon name="users" size={16} />
          <span>Creators</span>
          {initialCreators.length > 0 && (
            <span className="community-tab-count">
              {initialCreators.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "prompts" ? (
        <section aria-label="Shared prompts">
          <h2 className="sr-only">Shared prompts</h2>
          <PromptGrid
            initial={initialPrompts}
            availableTags={availableTags}
            showFilters={true}
          />
        </section>
      ) : (
        <section aria-label="Community creators">
          <h2 className="sr-only">Community creators</h2>
          <CreatorGrid initialCreators={initialCreators} />
        </section>
      )}
    </div>
  );
}
