"use client";

import { useState } from "react";
import { json } from "@/lib/client/api";
import Button from "@/components/ui/Button";

type Props = {
  prompt: string;
  onSave(): void;
};

export default function PromptPreview({ prompt, onSave }: Props) {
  const [message, setMessage] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [running, setRunning] = useState(false);

  async function copy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("Prompt copied.");
    } catch {
      setMessage("Copy unavailable. Select the text and copy it.");
    }
  }

  function download() {
    if (!prompt) return;
    const url = URL.createObjectURL(
      new Blob([`# My prompt\n\n${prompt}\n`], { type: "text/markdown" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "promptdock-prompt.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function testPrompt() {
    if (!prompt || running) return;
    setRunning(true);
    setMessage("Testing your finished prompt…");
    try {
      const result = await json<{ text: string; provider: string }>(
        "/api/run",
        "POST",
        { prompt },
      );
      setRunOutput(result.text);
      setMessage(`Tested with ${result.provider}.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not test this prompt.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="preview-card" aria-labelledby="previewHeading">
      <div className="preview-top">
        <div className="section-kicker">PROMPT OUTPUT</div>
        <span
          className="ready-badge"
          style={{ visibility: prompt ? "visible" : "hidden" }}
        >
          <span className="status-dot" /> Ready to copy
        </span>
      </div>
      <h2 id="previewHeading">
        {prompt ? "Your finished prompt" : "Your prompt will appear here"}
      </h2>
      <p className="preview-subtitle">
        {prompt
          ? "Review and refine it before using it with any AI platform."
          : "Share your idea, then let PromptDock shape it."}
      </p>
      <div
        className={`prompt-output${prompt ? "" : " is-empty"}`}
        tabIndex={0}
        aria-live="polite"
      >
        {prompt ||
          "Your prompt will appear here after PromptDock shapes your idea."}
      </div>
      <div className="preview-actions">
        <Button variant="primary" disabled={!prompt} onClick={copy}>
          <span>▣</span> Copy prompt <span className="button-arrow">↗</span>
        </Button>
        <Button disabled={!prompt} onClick={onSave}>
          ♡ &nbsp; Save
        </Button>
      </div>
      <div className="export-row">
        <button
          type="button"
          className="quiet-button"
          disabled={!prompt}
          onClick={download}
        >
          ↓ Download .md
        </button>
        <span className="word-count">
          {prompt ? `${prompt.trim().split(/\s+/).length} words` : "0 words"}
        </span>
      </div>
      <div className="run-row">
        <button
          type="button"
          className="ai-button run-button"
          disabled={!prompt || running}
          onClick={testPrompt}
        >
          <span>▶</span> Run prompt
        </button>
        <span className="run-note">
          Tests this prompt on your configured AI
        </span>
      </div>
      {message && (
        <p className="settings-feedback" role="status">
          {message}
        </p>
      )}
      {runOutput && (
        <div className="run-card">
          <div className="section-kicker">TEST RESULT</div>
          <p>{runOutput}</p>
        </div>
      )}
    </section>
  );
}
