"use client";

import { useState, useEffect, useRef } from "react";
import IdeaCard from "./IdeaCard";
import FineTunePanel from "./FineTunePanel";
import ClarificationPanel from "./ClarificationPanel";
import PromptPreview from "./PromptPreview";
import InterpretationCard from "./InterpretationCard";
import PromptCheck from "./PromptCheck";
import PlatformLinks from "./PlatformLinks";
import PromptEditor from "./PromptEditor";
import Button from "@/components/ui/Button";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { useSavePrompt } from "@/hooks/useSavePrompt";
import SharePromptDialog from "@/components/library/SharePromptDialog";
import { Icon } from "@/components/ui/Icon";
import { visibilityState } from "@/lib/community/visibility-state";

import { useSearchParams } from "next/navigation";

export default function PromptWorkspace() {
  const builder = usePromptBuilder();
  const searchParams = useSearchParams();
  const remixId = searchParams.get("remix");
  const [remixSourcePublicId, setRemixSourcePublicId] = useState<string | null>(
    null,
  );

  const savePrompt = useSavePrompt({ remixSourcePublicId });

  // Keep the composer in view while a long result scrolls past, but only
  // when the whole composer fits in the window; otherwise its lower half
  // (fine-tune fields, the generate button) would be unreachable.
  const composePane = useRef<HTMLDivElement>(null);
  const [composeFits, setComposeFits] = useState(false);
  useEffect(() => {
    const element = composePane.current;
    if (!element) return;
    const measure = () =>
      setComposeFits(element.offsetHeight + 48 < window.innerHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const saved = builder.sourcePrompt;
  const visibility = saved ? visibilityState(saved) : null;

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
      <div className="page-intro builder-intro">
        <div>
          <h1>
            Start with an idea. <em>Go further.</em>
          </h1>
          <p>
            Say what you want, however it comes out. PromptDock shapes it into a
            prompt you can use anywhere, and shows you what it changed.
          </p>
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
      <div className="builder-panes">
        <div
          ref={composePane}
          className={`react-composer-flow builder-pane builder-pane--compose${
            composeFits ? " is-pinned" : ""
          }`}
        >
          <IdeaCard
            idea={builder.idea}
            busy={builder.busy}
            attachments={builder.attachments}
            setIdea={builder.setIdea}
            addImages={builder.addImages}
            removeImage={builder.removeImage}
            onSubmit={builder.generate}
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
        <div className="builder-pane builder-pane--result">
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
            <InterpretationCard
              key={builder.documentRevision}
              interpretation={builder.result.interpretation}
            />
          )}
          {builder.ready && builder.data && (
            <PromptEditor
              data={builder.data}
              onChange={builder.editPromptField}
            />
          )}
          <PromptCheck data={builder.data} />
        </div>
      </div>
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
              {saved && visibility && (
                <div className="details-visibility">
                  <span>Who can see it</span>
                  <button
                    type="button"
                    className={`visibility-badge is-${visibility.id}`}
                    onClick={() => {
                      setSaveOpen(false);
                      setShareOpen(true);
                    }}
                  >
                    <Icon name={visibility.icon} size={12} />
                    <span>{visibility.label} · Change</span>
                  </button>
                </div>
              )}
              {saveError && (
                <p role="alert" className="settings-feedback">
                  {saveError}
                </p>
              )}
              <div className="react-modal-actions">
                <Button
                  variant="primary"
                  type="submit"
                  loading={saving}
                  loadingText="Saving…"
                >
                  Save details
                </Button>
                <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
              </div>
            </form>
          </section>
        </div>
      )}
      {shareOpen && saved && (
        <SharePromptDialog
          prompt={saved}
          username={null}
          close={() => setShareOpen(false)}
          publish={async () => undefined}
          setPrompt={builder.savedPrompt}
        />
      )}
    </div>
  );
}
