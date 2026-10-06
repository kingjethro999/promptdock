"use client";

import AppDialog from "@/components/ui/AppDialog";
import Button from "@/components/ui/Button";
import type { SavedPrompt } from "@/lib/prompt/types";

export default function ConfirmPromptDialog({
  prompt,
  close,
  remove,
}: {
  prompt: SavedPrompt;
  close(): void;
  remove(): Promise<void>;
}) {
  return (
    <AppDialog
      className="confirm-dialog is-danger"
      label="Delete prompt"
      close={close}
    >
      <button
        className="dialog-close"
        type="button"
        aria-label="Close confirmation"
        onClick={close}
      >
        ×
      </button>
      <span className="dialog-icon" aria-hidden="true">
        ×
      </span>
      <span className="confirm-kicker">PLEASE CONFIRM</span>
      <h2>Delete this prompt?</h2>
      <p>
        “{prompt.name}” will be removed from your library. Any public link to it
        will stop working.
      </p>
      <div className="dialog-actions">
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="primary"
          className="react-danger-accept"
          onClick={remove}
        >
          Delete prompt
        </Button>
      </div>
    </AppDialog>
  );
}
