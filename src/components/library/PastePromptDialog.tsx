"use client";

import { useState } from "react";
import AppDialog from "@/components/ui/AppDialog";
import Button from "@/components/ui/Button";

export default function PastePromptDialog({
  close,
  saving,
  paste,
}: {
  close(): void;
  saving: boolean;
  paste(
    name: string,
    content: string,
    tags: string,
  ): Promise<boolean | undefined>;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await paste(name, content, tags)) close();
  }

  async function fromClipboard() {
    try {
      setContent(await navigator.clipboard.readText());
      setError("");
    } catch {
      setError(
        "Clipboard access was blocked. Click the box and press Ctrl/Cmd + V.",
      );
    }
  }

  return (
    <AppDialog className="paste-dialog" label="Paste a prompt" close={close}>
      <form onSubmit={submit}>
        <button
          className="dialog-close"
          type="button"
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>
        <span className="dialog-icon" aria-hidden="true">
          ⎘
        </span>
        <h2>Paste a prompt</h2>
        <p>
          Already wrote a prompt somewhere else? Keep the full text here, then
          name it, tag it, and share it with your audience.
        </p>
        <label htmlFor="reactPasteName">Title</label>
        <input
          id="reactPasteName"
          type="text"
          maxLength={120}
          required
          placeholder="e.g. My trading bot system prompt"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor="reactPasteText">Prompt</label>
        <textarea
          id="reactPasteText"
          rows={10}
          required
          placeholder="Paste the whole prompt here — as long as you need."
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <button className="text-button" type="button" onClick={fromClipboard}>
          Paste from clipboard
        </button>
        <label htmlFor="reactPasteTags">
          Tags <span>(optional)</span>
        </label>
        <input
          id="reactPasteTags"
          type="text"
          maxLength={240}
          placeholder="e.g. trading, bots"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
        <small>Separate tags with commas. Up to 8 tags.</small>
        <p className="auth-error" role="alert">
          {error}
        </p>
        <div className="dialog-actions">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save to my library"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
