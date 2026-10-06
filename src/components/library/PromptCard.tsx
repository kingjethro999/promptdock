"use client";

import type { SavedPrompt } from "@/lib/prompt/types";

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
  return (
    <article className="library-card">
      <div className="library-card-top">
        <span className="library-card-icon" aria-hidden="true">
          ✦
        </span>
        <button
          type="button"
          className="card-menu"
          aria-label={`Delete ${prompt.name}`}
          onClick={() => onDelete(prompt)}
        >
          ×
        </button>
      </div>
      <h3>{prompt.name}</h3>
      <p>{prompt.data.task}</p>
      <div className="library-sharing">
        <span
          className={`visibility-badge${prompt.publicId ? " is-public" : ""}`}
        >
          {prompt.publicId ? "● Public" : "○ Private"}
        </span>
        <button
          className="library-share-button"
          type="button"
          onClick={() => onShare(prompt)}
        >
          {prompt.publicId ? "Share link ↗" : "Publish & share ↗"}
        </button>
        <button
          className="library-share-button"
          type="button"
          onClick={() => onHistory(prompt)}
        >
          History ↶
        </button>
        <button
          className="library-share-button"
          type="button"
          onClick={() => onDuplicate(prompt)}
        >
          Duplicate +
        </button>
      </div>
      <div className="library-card-footer">
        <span>
          {new Date(prompt.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <button type="button" onClick={() => onOpen(prompt)}>
          Open prompt →
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
