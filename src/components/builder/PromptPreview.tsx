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
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [useVariables, setUseVariables] = useState(true);
  const [message, setMessage] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareOutputs, setCompareOutputs] = useState<
    | { provider: string; text?: string; error?: string; success: boolean }[]
    | null
  >(null);

  const activePrompt =
    data && data.task?.trim() ? buildPromptWithProfile(data, profile) : prompt;

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

    const url = URL.createObjectURL(new Blob([header], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function testPrompt() {
    if (!finalPrompt || running || comparing) return;
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

  async function comparePrompt() {
    if (!finalPrompt || running || comparing) return;
    setComparing(true);
    setMessage("Running prompt across multiple models in parallel…");
    try {
      const result = await json<{
        results: {
          provider: string;
          text?: string;
          error?: string;
          success: boolean;
        }[];
      }>("/api/run", "POST", { prompt: finalPrompt, compare: true });
      setCompareOutputs(result.results);
      setMessage(
        `Comparison complete across ${result.results.length} model${
          result.results.length === 1 ? "" : "s"
        }.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not compare models right now.",
      );
    } finally {
      setComparing(false);
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
          disabled={!finalPrompt || running || comparing}
          onClick={testPrompt}
        >
          <span>▶</span> {running ? "Running…" : "Run prompt"}
        </button>
        <button
          type="button"
          className="ai-button arena-button"
          disabled={!finalPrompt || running || comparing}
          onClick={comparePrompt}
        >
          <span>⚔</span> {comparing ? "Comparing…" : "Compare (Arena)"}
        </button>
        <span className="run-note">
          Test on your configured AI or compare multi-model outputs
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

      {compareOutputs && (
        <div
          className="arena-card"
          role="region"
          aria-label="Model comparison arena"
        >
          <div className="arena-header">
            <div>
              <div className="section-kicker">MODEL ARENA</div>
              <h3>Side-by-side comparison</h3>
            </div>
            <button
              type="button"
              className="arena-close-btn"
              onClick={() => setCompareOutputs(null)}
              title="Close arena comparison"
            >
              ×
            </button>
          </div>
          <div className="arena-grid">
            {compareOutputs.map((item, idx) => (
              <div key={item.provider + idx} className="arena-column">
                <div className="arena-col-top">
                  <span className="arena-provider-pill">{item.provider}</span>
                  {item.text && (
                    <span className="arena-metric">
                      {item.text.trim().split(/\s+/).length} words
                    </span>
                  )}
                  {item.text && (
                    <button
                      type="button"
                      className="arena-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(item.text || "");
                        setMessage(`Copied ${item.provider} response.`);
                      }}
                      title="Copy response"
                    >
                      Copy
                    </button>
                  )}
                </div>
                {item.error ? (
                  <p className="arena-error">{item.error}</p>
                ) : (
                  <div className="arena-content">{item.text}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
