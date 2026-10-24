"use client";

import { useLayoutEffect, useRef, useState } from "react";
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

import SaveSplitButton from "./SaveSplitButton";
import { Icon } from "@/components/ui/Icon";
import type { useSavePrompt } from "@/hooks/useSavePrompt";

type Props = {
  prompt: string;
  ready: boolean;
  documentRevision: number;
  provider?: string;
  documentEdited?: boolean;
  sourceChanged?: boolean;
  onEdit?(text: string): void;
  data?: PromptData | null;
  onSave?: () => void;
  save?: ReturnType<typeof useSavePrompt>;
  onOpenDetails?: () => void;
  research?: ResearchMetadata;
};

export default function PromptPreview({
  prompt,
  ready,
  documentRevision,
  provider,
  documentEdited,
  sourceChanged,
  onEdit,
  data,
  onSave,
  save,
  onOpenDetails,
  research,
}: Props) {
  const [profile, setProfile] = useState<PromptProfile>("universal");
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const executionRevision = useRef(0);
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

  const activePrompt = !ready
    ? ""
    : data && data.task?.trim()
      ? buildPromptWithProfile(data, profile)
      : prompt;

  const finalPrompt = useVariables
    ? interpolatePrompt(activePrompt, variableValues)
    : activePrompt;

  useLayoutEffect(() => {
    setVariableValues({});
  }, [documentRevision]);

  // A response belongs to both a document version and its exact exported text.
  // Layout effects invalidate it before a newly selected document is painted.
  useLayoutEffect(() => {
    executionRevision.current += 1;
    setMessage("");
    setRunOutput("");
    setCompareOutputs(null);
    setRunning(false);
    setComparing(false);
    return () => {
      executionRevision.current += 1;
    };
  }, [documentRevision, finalPrompt]);

  useLayoutEffect(() => {
    if (!editor.current) return;
    editor.current.style.height = "auto";
    editor.current.style.height = `${editor.current.scrollHeight}px`;
  }, [prompt, editing]);

  async function copy() {
    if (!finalPrompt) return;
    const revision = executionRevision.current;
    try {
      await navigator.clipboard.writeText(finalPrompt);
      if (revision !== executionRevision.current) return;
      const currentProfile = PROMPT_PROFILES.find((p) => p.id === profile);
      setMessage(`Prompt copied (${currentProfile?.label || "Universal"}).`);
    } catch {
      if (revision === executionRevision.current)
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
    const url = URL.createObjectURL(new Blob([finalPrompt], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function testPrompt() {
    if (!finalPrompt || running || comparing) return;
    const revision = executionRevision.current;
    setRunning(true);
    setMessage("Testing the current prompt…");
    try {
      const result = await json<{ text: string; provider: string }>(
        "/api/run",
        "POST",
        { prompt: finalPrompt },
      );
      if (revision !== executionRevision.current) return;
      setRunOutput(result.text);
      setMessage(`Tested with ${result.provider}.`);
    } catch (error) {
      if (revision !== executionRevision.current) return;
      setMessage(
        error instanceof Error ? error.message : "Could not test this prompt.",
      );
    } finally {
      if (revision === executionRevision.current) setRunning(false);
    }
  }

  async function comparePrompt() {
    if (!finalPrompt || running || comparing) return;
    const revision = executionRevision.current;
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
      if (revision !== executionRevision.current) return;
      setCompareOutputs(result.results);
      setMessage(
        `Comparison complete across ${result.results.length} model${
          result.results.length === 1 ? "" : "s"
        }.`,
      );
    } catch (error) {
      if (revision !== executionRevision.current) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not compare models right now.",
      );
    } finally {
      if (revision === executionRevision.current) setComparing(false);
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
        {!ready
          ? "Your prompt will appear here"
          : documentEdited
            ? "Your edited prompt"
            : provider === "source-preserved"
              ? "Your preserved source"
              : provider === "library"
                ? "Your saved prompt"
                : "Your prompt"}
      </h2>
      <p className="preview-subtitle">
        {ready
          ? provider === "source-preserved"
            ? "Source preserved, not AI-refined. You can edit or copy it, or retry refinement from your source."
            : "Review or edit your document before using it. Export profiles change formatting; Save keeps the editable document."
          : "Share your idea, then let PromptDock shape it."}
      </p>
      {sourceChanged && (
        <p className="settings-feedback" role="status">
          Your source has changed. This is your previous prompt, kept until a
          new result succeeds.
        </p>
      )}

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

      {ready && onEdit && (
        <div className="prompt-document-tools">
          <Button
            variant="quiet"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
            aria-controls="promptDocumentEditor"
          >
            <Icon name="pencil" size={16} />{" "}
            {editing ? "Done editing" : "Edit prompt"}
          </Button>
        </div>
      )}
      {ready && editing && onEdit ? (
        <textarea
          ref={editor}
          id="promptDocumentEditor"
          className="prompt-document-editor"
          aria-label="Edit current prompt"
          value={prompt}
          onChange={(event) => onEdit(event.target.value)}
          autoFocus
          rows={10}
        />
      ) : (
        <div
          className={`prompt-output${finalPrompt ? "" : " is-empty"}`}
          tabIndex={0}
          aria-live="polite"
        >
          {finalPrompt ||
            "Your prompt will appear here after PromptDock shapes your idea."}
        </div>
      )}

      <div className="preview-actions">
        <Button variant="primary" disabled={!finalPrompt} onClick={copy}>
          <Icon name="copy" size={15} /> Copy prompt{" "}
          <span className="button-arrow"></span>
        </Button>
        {save ? (
          <SaveSplitButton
            save={save}
            disabled={!finalPrompt}
            onOpenDetails={onOpenDetails}
          />
        ) : (
          <Button disabled={!finalPrompt} onClick={onSave}>
            <Icon name="bookmark" size={15} /> Save
          </Button>
        )}
      </div>

      <div className="export-row">
        <Button
          variant="quiet"
          className="quiet-button"
          disabled={!finalPrompt}
          onClick={download}
        >
          <Icon name="arrow-down" size={16} /> Download{" "}
          {profile === "cursor" ? ".cursorrules" : `(${profile}) .md`}
        </Button>
        <span className="word-count">
          {finalPrompt
            ? `${finalPrompt.trim().split(/\s+/).length} words`
            : "0 words"}
        </span>
      </div>

      <div className="run-row">
        <Button
          variant="quiet"
          className="ai-button run-button"
          disabled={!finalPrompt || running || comparing}
          onClick={testPrompt}
        >
          <Icon name="zap" size={16} /> {running ? "Running…" : "Run"}
        </Button>
        <Button
          variant="quiet"
          className="ai-button arena-button"
          disabled={!finalPrompt || running || comparing}
          onClick={comparePrompt}
        >
          <Icon name="shuffle" size={16} />{" "}
          {comparing ? "Comparing…" : "Compare"}
        </Button>
        <span className="run-note">
          Test your AI or compare multi-model outputs.
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
