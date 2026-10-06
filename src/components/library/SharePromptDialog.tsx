"use client";

import { useEffect, useState } from "react";
import AppDialog from "@/components/ui/AppDialog";
import Button from "@/components/ui/Button";
import type { SavedPrompt } from "@/lib/prompt/types";

type Props = {
  prompt: SavedPrompt;
  username: string | null;
  close(): void;
  publish(
    prompt: SavedPrompt,
    published: boolean,
  ): Promise<SavedPrompt | undefined>;
  setPrompt(prompt: SavedPrompt): void;
};

export default function SharePromptDialog({
  prompt,
  username,
  close,
  publish,
  setPrompt,
}: Props) {
  const [notice, setNotice] = useState("");
  const publicLink =
    prompt.publicId && typeof window !== "undefined"
      ? `${window.location.origin}/p/${prompt.publicId}`
      : "";

  useEffect(() => {
    if (prompt.publicId)
      document.querySelector<HTMLInputElement>("#reactShareLink")?.select();
  }, [prompt.publicId]);

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(publicLink);
      else {
        const input =
          document.querySelector<HTMLInputElement>("#reactShareLink");
        input?.select();
        if (!document.execCommand("copy")) throw new Error("Copy failed");
      }
      setNotice("Link copied. Anyone with it can view this prompt.");
    } catch {
      document.querySelector<HTMLInputElement>("#reactShareLink")?.select();
      setNotice("Select the link above to copy it.");
    }
  }

  if (!prompt.publicId)
    return (
      <AppDialog
        key="publish"
        className="confirm-dialog"
        label="Publish prompt"
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
          ✳
        </span>
        <span className="confirm-kicker">PLEASE CONFIRM</span>
        <h2>Make this prompt public?</h2>
        <p>
          Anyone with the link can view and copy its finished prompt. Your
          private notes stay hidden.
        </p>
        <div className="dialog-actions">
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              const result = await publish(prompt, true);
              if (result) setPrompt(result);
            }}
          >
            Publish prompt
          </Button>
        </div>
      </AppDialog>
    );

  return (
    <AppDialog
      key="share"
      className="share-dialog"
      label="Share prompt"
      close={close}
    >
      <button
        className="dialog-close"
        type="button"
        aria-label="Close"
        onClick={close}
      >
        ×
      </button>
      <span className="dialog-icon" aria-hidden="true">
        ↗
      </span>
      <h2>Share this prompt</h2>
      {username && (
        <p className="share-attribution">
          {username} shared a prompt with you.
        </p>
      )}
      <p>
        Anyone with this link can view and copy the finished prompt. Your email
        and private idea notes stay hidden.
      </p>
      <label htmlFor="reactShareLink">Public link</label>
      <input
        id="reactShareLink"
        type="text"
        readOnly
        aria-label="Public prompt link"
        value={publicLink}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="dialog-actions">
        <Button
          onClick={async () => {
            const result = await publish(prompt, false);
            if (result) close();
          }}
        >
          Make private
        </Button>
        <Button variant="primary" onClick={copy}>
          Copy link
        </Button>
      </div>
      <p className="settings-feedback" role="status">
        {notice}
      </p>
    </AppDialog>
  );
}
