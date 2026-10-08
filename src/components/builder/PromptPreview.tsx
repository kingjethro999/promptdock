"use client";

import { useState } from "react";
import { json } from "@/lib/client/api";
import Button from "@/components/ui/Button";
import type { PromptData, ResearchMetadata } from "@/lib/prompt/types";
import {
  PROMPT_PROFILES,
  buildPromptWithProfile,
  type PromptProfile,
} from "@/lib/prompt/format";
import { interpolatePrompt } from "@/lib/prompt/variables";
import ResearchDrawer from "./ResearchDrawer";
import PromptVariablesForm from "./PromptVariablesForm";

type Props = {
  prompt: string;
  data?: PromptData | null;
  onSave(): void;
  research?: ResearchMetadata;
};

export default function PromptPreview({
  prompt,
  data,
  onSave,
  research,
}: Props) {
  const [profile, setProfile] = useState<PromptProfile>("universal");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [useVariables, setUseVariables] = useState(true);
  const [message, setMessage] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [running, setRunning] = useState(false);

  const activePrompt =
    data && data.task?.trim()
      ? buildPromptWithProfile(data, profile)
      : prompt;

  const finalPrompt = useVariables
    ? interpolatePrompt(activePrompt, variableValues)
    : activePrompt;

  async function copy() {
    if (!finalPrompt) return;
    try {
      await navigator.clipboard.writeText(finalPrompt);
      const currentProfile = PROMPT_PROFILES.find((p) => p.id === profile);
      setMessage(`Prompt copied (${currentProfile?.label || "Universal"}).`);
    } catch {
      setMessage("Copy unavailable. Select the text and copy it.");
    }
  }

  function download() {
    if (!finalPrompt) return;
    const currentProfile = PROMPT_PROFILES.find((p) => p.id === profile);
    const filename =
      currentProfile?.id === "cursor"
        ? ".cursorrules"
        : `promptdock-${currentProfile?.id || "prompt"}.md`;
    const mime =
      currentProfile?.id === "cursor" ? "text/plain" : "text/markdown";
    const header =
      currentProfile?.id === "cursor"
        ? `${finalPrompt}\n`
        : `# My prompt (${currentProfile?.label})\n\n${finalPrompt}\n`;

    const url = URL.createObjectURL(
      new Blob([header], { type: mime }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function testPrompt() {
    if (!finalPrompt || running) return;
    setRunning(true);
    setMessage("Testing your finished prompt…");
    try {
      const result = await json<{ text: string; provider: string }>(
        "/api/run",
        "POST",
        { prompt: finalPrompt },
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
          style={{ visibility: finalPrompt ? "visible" : "hidden" }}
        >
          <span className="status-dot" /> Ready to copy
        </span>
      </div>
      <h2 id="previewHeading">
        {finalPrompt ? "Your finished prompt" : "Your prompt will appear here"}
      </h2>
      <p className="preview-subtitle">
        {finalPrompt
          ? "Review and optimize it for your target AI platform."
          : "Share your idea, then let PromptDock shape it."}
      </p>

      {activePrompt && (
        <div
          className="prompt-profile-tabs"
          role="tablist"
          aria-label="Target model optimization profiles"
        >
          {PROMPT_PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={profile === p.id}
              className={`profile-tab-btn${profile === p.id ? " active" : ""}`}
              onClick={() => {
                setProfile(p.id);
                setMessage(`Switched syntax profile to ${p.label}`);
              }}
            >
              <span className="profile-label">{p.label}</span>
              <span className="profile-badge">{p.badge}</span>
            </button>
          ))}
        </div>
      )}

      {activePrompt && (
        <PromptVariablesForm
          promptText={activePrompt}
          values={variableValues}
          onChange={(field, value) =>
            setVariableValues((prev) => ({ ...prev, [field]: value }))
          }
          onReset={() => setVariableValues({})}
          enabled={useVariables}
          onToggle={setUseVariables}
        />
      )}

      {activePrompt && <ResearchDrawer research={research} />}

      <div
        className={`prompt-output${finalPrompt ? "" : " is-empty"}`}
        tabIndex={0}
        aria-live="polite"
      >
        {finalPrompt ||
          "Your prompt will appear here after PromptDock shapes your idea."}
      </div>

      <div className="preview-actions">
        <Button variant="primary" disabled={!finalPrompt} onClick={copy}>
          <span>▣</span> Copy prompt <span className="button-arrow">↗</span>
        </Button>
        <Button disabled={!finalPrompt} onClick={onSave}>
          ♡ &nbsp; Save
        </Button>
      </div>

      <div className="export-row">
        <button
          type="button"
          className="quiet-button"
          disabled={!finalPrompt}
          onClick={download}
        >
          ↓ Download{" "}
          {profile === "cursor" ? ".cursorrules" : `(${profile}) .md`}
        </button>
        <span className="word-count">
          {finalPrompt
            ? `${finalPrompt.trim().split(/\s+/).length} words`
            : "0 words"}
        </span>
      </div>

      <div className="run-row">
        <button
          type="button"
          className="ai-button run-button"
          disabled={!finalPrompt || running}
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
