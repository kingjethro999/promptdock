"use client";

import { useState, useEffect } from "react";
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
import { useSavePrompt } from "@/hooks/useSavePrompt";

import { useSearchParams } from "next/navigation";

const builderColumnWeights = [1.1, 0.9] as const;

export default function PromptWorkspace() {
  const builder = usePromptBuilder();
  const searchParams = useSearchParams();
  const remixId = searchParams.get("remix");
  const [remixSourcePublicId, setRemixSourcePublicId] = useState<string | null>(
    null,
  );

  const savePrompt = useSavePrompt({ remixSourcePublicId });

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!remixId) return;
    fetch(`/api/community/prompts/${remixId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) {
          builder.loadPrompt({
            id: crypto.randomUUID(),
            name: `${data.name} (Remix)`,
            data: data.data,
            idea: data.data.task || "",
            analysis: null,
            tags: data.tags || [],
            publicId: null,
            updatedAt: new Date().toISOString(),
          });
          setName(`${data.name} (Remix)`);
          setTags((data.tags || []).join(", "));
          setRemixSourcePublicId(remixId);
        }
      })
      .catch(() => {});
  }, [remixId]);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!builder.data || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const parsedTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await savePrompt.ensureSaved({
        name: name.trim() || undefined,
        tags: parsedTags,
      });
      setSaveOpen(false);
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
            researchMode={builder.researchMode}
            setResearchMode={builder.setResearchMode}
            referenceUrl={builder.referenceUrl}
            setReferenceUrl={builder.setReferenceUrl}
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
          ready={builder.ready}
          provider={builder.result?.provider}
          documentRevision={builder.documentRevision}
          documentEdited={builder.documentEdited}
          sourceChanged={
            builder.ready && builder.idea !== builder.documentSource
          }
          onEdit={builder.editDocument}
          data={builder.data}
          research={builder.result?.research}
          save={savePrompt}
          onOpenDetails={() => {
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
            <div className="section-kicker">PROMPT DETAILS</div>
            <h2 id="saveTitle">Name and tags</h2>
            <p>Customize how this prompt appears in your library.</p>
            <form onSubmit={saveDetails}>
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
                  {saving ? "Saving…" : "Save details"}
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
