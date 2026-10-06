"use client";

import { useVoiceIdea } from "@/hooks/useVoiceIdea";
import type { Attachment } from "@/hooks/useAttachments";
import { useState } from "react";

type Props = {
  idea: string;
  busy: boolean;
  attachments: Attachment[];
  setIdea(value: string): void;
  addImages(files: File[]): void;
  removeImage(index: number): void;
};

export default function IdeaCard({
  idea,
  busy,
  attachments,
  setIdea,
  addImages,
  removeImage,
}: Props) {
  const [imageError, setImageError] = useState("");
  const voice = useVoiceIdea((text) =>
    setIdea([idea.trim(), text.trim()].filter(Boolean).join("\n")),
  );
  return (
    <section className="idea-card" aria-labelledby="ideaHeading">
      <div className="idea-card-top">
        <span className="idea-symbol">✳</span>
        <span className="section-kicker">IDEA → PROMPT</span>
        <span className="idea-step">START HERE</span>
      </div>
      <h2 id="ideaHeading">What is your idea?</h2>
      <p>
        Write it naturally. A sentence, a messy thought, or a full brief all
        work. Already have a prompt? Paste it here too.
      </p>
      <label className="sr-only" htmlFor="ideaInput">
        Describe your idea
      </label>
      <div className="idea-input-wrap">
        <textarea
          id="ideaInput"
          rows={5}
          maxLength={100000}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="I have an idea for an app that helps students study, but I'm not sure what features it needs…"
        />
        <div className="voice-controls">
          <button
            type="button"
            className="mic-button"
            disabled={busy || !voice.available || voice.phase === "sending"}
            onClick={() =>
              voice.phase === "recording" ? voice.stop(true) : voice.start()
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8" />
            </svg>
            <span>
              {voice.phase === "recording" ? "Stop & send" : "Record idea"}
            </span>
          </button>
          {voice.phase === "recording" && (
            <button
              type="button"
              className="voice-cancel"
              onClick={() => voice.stop(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="voice-status" role="status">
        {voice.message}
      </div>
      <div className="idea-image-tools">
        <label className="idea-image-add" htmlFor="ideaImages">
          ＋ Add images
        </label>
        <input
          id="ideaImages"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            try {
              addImages(Array.from(event.target.files || []));
              setImageError("");
            } catch (error) {
              setImageError(
                error instanceof Error
                  ? error.message
                  : "Could not add images.",
              );
            }
            event.target.value = "";
          }}
        />
        <span role="status">
          {imageError ||
            (attachments.length
              ? `${attachments.length} image${attachments.length === 1 ? "" : "s"} attached`
              : "Up to 3 images · large images optimized automatically")}
        </span>
      </div>
      {attachments.length > 0 && (
        <div className="idea-image-tray" aria-label="Attached images">
          {attachments.map((item, index) => (
            <div className="idea-image-item" key={item.preview}>
              <img src={item.preview} alt={item.file.name} />
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => removeImage(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="idea-examples">
        <span>TRY AN EXAMPLE</span>
        <button
          type="button"
          className="idea-example"
          onClick={() =>
            setIdea(
              "I want to start a small online business selling handmade skincare, but I do not know where to begin.",
            )
          }
        >
          Start a business
        </button>
        <button
          type="button"
          className="idea-example"
          onClick={() =>
            setIdea(
              "I have an idea for an app that helps people plan meals from ingredients they already have. Help me think it through.",
            )
          }
        >
          Plan an app
        </button>
      </div>
    </section>
  );
}
