"use client";

import { useRef, useState } from "react";
import type { SavedPrompt } from "@/lib/prompt/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { SaveToPanel } from "@/components/collections/SaveToPanel";
import { visibilityState } from "@/lib/community/visibility-state";

type Props = {
  prompt: SavedPrompt;
  onOpen(prompt: SavedPrompt): void;
  onDuplicate(prompt: SavedPrompt): void;
  onShare(prompt: SavedPrompt): void;
  onDelete(prompt: SavedPrompt): void;
  onHistory(prompt: SavedPrompt): void;
};

const MAX_TAGS = 3;

/**
 * One saved prompt in the library grid. The title opens the prompt; every
 * other action lives in the card menu so nothing competes with the title.
 */
export default function PromptCard({
  prompt,
  onOpen,
  onDuplicate,
  onShare,
  onDelete,
  onHistory,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const state = visibilityState(prompt);
  const hiddenTags = prompt.tags.length - MAX_TAGS;

  const actions: {
    label: string;
    icon: IconName;
    run(): void;
    danger?: boolean;
  }[] = [
    {
      label: prompt.publicId ? "Sharing and visibility" : "Publish and share",
      icon: state.icon,
      run: () => onShare(prompt),
    },
    {
      label: "Save to a collection",
      icon: "folder-plus",
      run: () => setCollectionsOpen(true),
    },
    { label: "Version history", icon: "refresh", run: () => onHistory(prompt) },
    { label: "Duplicate", icon: "plus", run: () => onDuplicate(prompt) },
    { label: "Delete", icon: "x", run: () => onDelete(prompt), danger: true },
  ];

  return (
    <article className="library-card prompt-card">
      <div className="prompt-card-head">
        <button
          type="button"
          className={`visibility-badge is-${state.id}`}
          onClick={() => onShare(prompt)}
          aria-label={`${state.label}. Change who can see ${prompt.name}`}
          title={state.hint}
        >
          <Icon name={state.icon} size={12} />
          <span>{state.label}</span>
        </button>
        <button
          ref={menuButton}
          type="button"
          className="prompt-card-menu"
          aria-label={`Actions for ${prompt.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      <h3>
        <button
          type="button"
          className="prompt-card-title"
          onClick={() => onOpen(prompt)}
        >
          <span>{prompt.name}</span>
        </button>
      </h3>
      <p className="prompt-card-summary">{prompt.data.task}</p>

      <div className="prompt-tags prompt-card-tags">
        {prompt.tags.slice(0, MAX_TAGS).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        {hiddenTags > 0 && (
          <span
            className="prompt-card-more-tags"
            title={prompt.tags.slice(MAX_TAGS).join(", ")}
          >
            +{hiddenTags}
            <span className="sr-only"> more tags</span>
          </span>
        )}
      </div>

      <div className="library-card-footer prompt-card-footer">
        <time dateTime={new Date(prompt.updatedAt).toISOString()}>
          {new Date(prompt.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <button type="button" onClick={() => onOpen(prompt)}>
          <span>Open</span>
          <Icon name="arrow-right" size={12} />
        </button>
      </div>

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuButton}
        label={`Actions for ${prompt.name}`}
      >
        <ul className="prompt-card-actions" role="menu">
          {actions.map((action) => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={action.danger ? "is-danger" : undefined}
                onClick={() => {
                  setMenuOpen(false);
                  action.run();
                }}
              >
                <Icon name={action.icon} size={14} />
                <span>{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Popover>

      <Popover
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        anchorRef={menuButton}
        label="Save to a collection"
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
    </article>
  );
}
