"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IdeaCard from "./IdeaCard";
import FineTunePanel from "./FineTunePanel";
import ClarificationPanel from "./ClarificationPanel";
import PromptPreview from "./PromptPreview";
import InterpretationCard from "./InterpretationCard";
import PromptCheck from "./PromptCheck";
import PlatformLinks from "./PlatformLinks";
import PromptEditor from "./PromptEditor";
import Button from "@/components/ui/Button";
import Masonry from "@/components/ui/Masonry";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { json } from "@/lib/client/api";
import type { SavedPrompt } from "@/lib/prompt/types";

const builderColumnWeights = [1.1, 0.9] as const;

export default function PromptWorkspace() {
  const builder = usePromptBuilder();
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!builder.data || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const parsedTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const result = await json<{ prompt: SavedPrompt }>(
        "/api/prompts",
        "PUT",
        {
          id: builder.sourcePrompt?.id || crypto.randomUUID(),
          name:
            name.trim() ||
            builder.sourcePrompt?.name ||
            builder.data.task.slice(0, 90),
          data: builder.data,
          idea: builder.idea,
          analysis:
            builder.result?.interpretation ||
            builder.sourcePrompt?.analysis ||
            null,
          tags: parsedTags.length
            ? parsedTags
            : builder.sourcePrompt?.tags || [],
        },
      );
      builder.savedPrompt(result.prompt);
      setSaveOpen(false);
      router.push("/library");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save prompt.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="react-workspace-page builder-view">
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-star">✳</span> THE PROMPT WORKSPACE
          </div>
          <h1>
            Start with an idea. <em>Go further.</em>
          </h1>
          <p>
            Tell us what is on your mind. We will shape it into a prompt you can
            use anywhere.
          </p>
        </div>
        <div className="intro-decoration" aria-hidden="true">
          <span>✳</span>
        </div>
      </div>
      <div className="workflow-steps" aria-label="Workflow">
        <span className="step active">
          <b>01</b> Describe it
        </span>
        <span className="step-line" />
        <span
          className={`step${builder.pending || builder.prompt ? " active" : ""}`}
        >
          <b>02</b> Shape it
        </span>
        <span className="step-line" />
        <span className={`step${builder.prompt ? " active" : ""}`}>
          <b>03</b> Take it anywhere
        </span>
      </div>
      <Masonry
        className="react-builder-masonry"
        minColumnWidth={460}
        rowGap={17}
        columnWeights={builderColumnWeights}
      >
        <div className="react-composer-flow">
          <IdeaCard
            idea={builder.idea}
            busy={builder.busy}
            attachments={builder.attachments}
            setIdea={builder.setIdea}
            addImages={builder.addImages}
            removeImage={builder.removeImage}
          />
          {builder.pending && (
            <ClarificationPanel
              questions={builder.pending.questions}
              answers={builder.pending.answers}
              busy={builder.busy}
              missingImages={Math.max(
                0,
                (builder.pending.imageCount || 0) - builder.attachments.length,
              )}
              answer={builder.answer}
              finish={builder.finishClarification}
            />
          )}
          <FineTunePanel
            guidance={builder.guidance}
            update={builder.updateGuidance}
            idea={builder.idea}
            imageCount={builder.attachments.length}
            busy={builder.busy}
            status={builder.status}
            generate={builder.generate}
            clear={builder.clear}
          />
        </div>
        <PromptPreview
          prompt={builder.prompt}
          research={builder.result?.research}
          onSave={() => {
            setSaveError("");
            setName(builder.sourcePrompt?.name || "");
            setTags(builder.sourcePrompt?.tags.join(", ") || "");
            setSaveOpen(true);
          }}
        />
        {builder.result?.interpretation && (
          <InterpretationCard interpretation={builder.result.interpretation} />
        )}
        {builder.ready && builder.data && (
          <PromptEditor
            data={builder.data}
            onChange={builder.editPromptField}
          />
        )}
        <PromptCheck data={builder.data} />
      </Masonry>
      <PlatformLinks />
      {saveOpen && (
        <div
          className="react-modal-backdrop"
          onClick={() => setSaveOpen(false)}
        >
          <section
            className="react-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saveTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="react-modal-close"
              aria-label="Close"
              onClick={() => setSaveOpen(false)}
            >
              ×
            </button>
            <div className="section-kicker">YOUR LIBRARY</div>
            <h2 id="saveTitle">Save this prompt</h2>
            <p>Keep it in your account and open it on any device.</p>
            <form onSubmit={save}>
              <label className="react-field">
                <span>Name</span>
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={builder.data?.task.slice(0, 90) || "My prompt"}
                />
              </label>
              <label className="react-field">
                <span>Tags, separated by commas</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="writing, work, ideas"
                />
              </label>
              {saveError && (
                <p role="alert" className="settings-feedback">
                  {saveError}
                </p>
              )}
              <div className="react-modal-actions">
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save prompt"}
                </Button>
                <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
