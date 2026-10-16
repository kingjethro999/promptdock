"use client";

import { useRef, useState } from "react";
import type { SavedPrompt } from "@/lib/prompt/types";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { SaveToPanel } from "@/components/collections/SaveToPanel";

type Props = {
  prompt: SavedPrompt;
  onOpen(prompt: SavedPrompt): void;
  onDuplicate(prompt: SavedPrompt): void;
  onShare(prompt: SavedPrompt): void;
  onDelete(prompt: SavedPrompt): void;
  onHistory(prompt: SavedPrompt): void;
};

export default function PromptCard({
  prompt,
  onOpen,
  onDuplicate,
  onShare,
  onDelete,
  onHistory,
}: Props) {
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const folderBtnRef = useRef<HTMLButtonElement>(null);

  const isPublic = prompt.visibility === "public";
  const isFollowers = prompt.visibility === "followers";

  return (
    <article className="library-card">
      <div className="library-card-top">
        <span className="library-card-icon" aria-hidden="true">
          <Icon name="sparkles" size={14} />
        </span>
        <button
          type="button"
          className="card-menu"
          aria-label={`Delete ${prompt.name}`}
          onClick={() => onDelete(prompt)}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      <h3>{prompt.name}</h3>
      <p>{prompt.data.task}</p>

      <div className="library-sharing">
        <button
          type="button"
          className={`visibility-badge${isPublic ? " is-public" : isFollowers ? " is-followers" : ""}`}
          onClick={() => onShare(prompt)}
          title="Change privacy (Public, Followers, or Private)"
        >
          <Icon
            name={isPublic ? "globe" : isFollowers ? "users" : "lock"}
            size={12}
          />
          <span>
            {isPublic ? "Public" : isFollowers ? "Followers" : "Private"}
          </span>
        </button>

        <button
          className="library-share-button"
          type="button"
          onClick={() => onShare(prompt)}
        >
          <span>{prompt.publicId ? "Share link" : "Publish & share"}</span>
          <Icon name="arrow-up-right" size={12} />
        </button>

        <button
          ref={folderBtnRef}
          className={`library-share-button${collectionsOpen ? " is-active" : ""}`}
          type="button"
          onClick={() => setCollectionsOpen((prev) => !prev)}
          title="Add to playlist or folder"
          aria-label="Add to playlist or folder"
          aria-haspopup="dialog"
          aria-expanded={collectionsOpen}
        >
          <Icon name="folder-plus" size={12} />
          <span>Save to…</span>
        </button>

        <button
          className="library-share-button"
          type="button"
          onClick={() => onHistory(prompt)}
        >
          <span>History</span>
          <Icon name="refresh" size={12} />
        </button>

        <button
          className="library-share-button"
          type="button"
          onClick={() => onDuplicate(prompt)}
        >
          <span>Duplicate</span>
          <Icon name="plus" size={12} />
        </button>
      </div>

      <Popover
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        anchorRef={folderBtnRef}
        label="Save to playlist or folder"
      >
        <SaveToPanel
          target={{
            kind: "saved",
            promptId: prompt.id,
            promptTitle: prompt.name,
          }}
          onDone={() => setCollectionsOpen(false)}
        />
      </Popover>

      <div className="library-card-footer">
        <span>
          {new Date(prompt.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <button type="button" onClick={() => onOpen(prompt)}>
          <span>Open prompt</span>
          <Icon name="arrow-right" size={12} />
        </button>
      </div>

      {prompt.tags.length > 0 && (
        <div className="prompt-tags">
          {prompt.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
    </article>
  );
}
