"use client";

import React, { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { SaveToPanel } from "@/components/collections/SaveToPanel";
import type { useSavePrompt } from "@/hooks/useSavePrompt";

export interface SaveSplitButtonProps {
  save: ReturnType<typeof useSavePrompt>;
  disabled?: boolean;
  onOpenDetails?: () => void;
  className?: string;
}

export function SaveSplitButton({
  save,
  disabled = false,
  onOpenDetails,
  className = "",
}: SaveSplitButtonProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSaving = save.phase === "saving";
  const isSavedClean = save.phase === "saved" && !save.dirty;
  const isSavedDirty = save.phase === "saved" && save.dirty;

  const handleMainClick = async () => {
    if (disabled || isSaving) return;

    if (isSavedClean) {
      // Already saved and unmodified: open popover
      setPopoverOpen(true);
      return;
    }

    try {
      await save.ensureSaved();
      setPopoverOpen(true);
    } catch {
      // Error handled by hook phase state
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setPopoverOpen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`save-split-btn-group ${className}`.trim()}
    >
      <button
        type="button"
        className={`save-split-main ${isSavedClean ? "is-saved" : ""}`}
        disabled={disabled || isSaving}
        onClick={handleMainClick}
        aria-label={
          isSaving
            ? "Saving prompt…"
            : isSavedClean
              ? "Saved to library"
              : isSavedDirty
                ? "Save changes to library"
                : "Save prompt to library"
        }
      >
        {isSaving ? (
          <>
            <Icon name="refresh" size={14} className="save-split-spin" />
            <span>Saving…</span>
          </>
        ) : isSavedClean ? (
          <>
            <Icon name="check" size={14} className="save-split-check" />
            <span>Saved</span>
          </>
        ) : isSavedDirty ? (
          <>
            <Icon name="bookmark" size={14} />
            <span>Save changes</span>
          </>
        ) : (
          <>
            <Icon name="bookmark" size={14} />
            <span>Save prompt</span>
          </>
        )}
      </button>

      <button
        type="button"
        className="save-split-toggle"
        disabled={disabled}
        onClick={handleToggleClick}
        aria-label="Save to playlist or folder"
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
      >
        <Icon name="chevron-down" size={14} />
      </button>

      <Popover
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        anchorRef={containerRef}
        label="Save prompt"
        align="end"
      >
        <SaveToPanel
          target={{
            kind: "draft",
            save,
            onOpenDetails,
          }}
          onDone={() => setPopoverOpen(false)}
        />
      </Popover>
    </div>
  );
}

export default SaveSplitButton;
