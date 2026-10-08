"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import GuidanceSelect from "@/components/ui/GuidanceSelect";
import type { Guidance, GuidanceField } from "@/lib/prompt/types";

const formats = [
  "Bulleted list",
  "Step-by-step guide",
  "Table",
  "Email",
  "Social post",
  "Article",
  "Code with explanation",
  "JSON",
];
const tones = [
  "Clear and concise",
  "Friendly",
  "Professional",
  "Persuasive",
  "Creative",
  "Educational",
];
const depths = ["Quick", "Balanced", "Deep"];

type Props = {
  guidance: Guidance;
  update(field: GuidanceField, value: string): void;
  researchMode?: "auto" | "on" | "off";
  setResearchMode?(mode: "auto" | "on" | "off"): void;
  referenceUrl?: string;
  setReferenceUrl?(url: string): void;
  idea: string;
  imageCount: number;
  busy: boolean;
  status: string;
  generate(): void;
  clear(): void;
};

export default function FineTunePanel({
  guidance,
  update,
  researchMode = "auto",
  setResearchMode,
  referenceUrl = "",
  setReferenceUrl,
  idea,
  imageCount,
  busy,
  status,
  generate,
  clear,
}: Props) {
  const [open, setOpen] = useState(false);
  const textField = (
    field: GuidanceField,
    label: string,
    hint: string,
    placeholder: string,
    rows = 0,
  ) => (
    <div className="field" key={field}>
      <label htmlFor={field}>
        {label} <span className="optional">{hint}</span>
      </label>
      {rows ? (
        <textarea
          id={field}
          rows={rows}
          value={guidance[field] || ""}
          placeholder={placeholder}
          onChange={(event) => update(field, event.target.value)}
        />
      ) : (
        <input
          id={field}
          type="text"
          autoComplete="off"
          value={guidance[field] || ""}
          placeholder={placeholder}
          onChange={(event) => update(field, event.target.value)}
        />
      )}
    </div>
  );

  return (
    <section
      className={`composer-card react-finetune${open ? "" : " is-collapsed"}`}
      aria-labelledby="composerHeading"
    >
      <div className="card-heading">
        <div>
          <div className="section-kicker">✦ &nbsp; OPTIONAL DETAILS</div>
          <h2 id="composerHeading">Fine-tune your prompt</h2>
          <p>
            Know the tone, format, or focus you want? Add it here. Otherwise,
            your idea is enough to get started.
          </p>
        </div>
        <button
          className="text-button"
          type="button"
          aria-expanded={open}
          aria-controls="promptForm"
          onClick={() => setOpen(!open)}
        >
          Fine-tune (optional) {open ? "⌃" : "⌄"}
        </button>
      </div>
      {open && (
        <div className="react-guidance-fields" id="promptForm">
          <div className="form-tools">
            <button
              className="text-button react-guidance-clear"
              type="button"
              onClick={clear}
            >
              ↺ &nbsp; Clear idea and guidance
            </button>
          </div>
          <div className="field-row">
            {textField(
              "role",
              "Act as",
              "optional",
              "e.g. A senior copywriter",
            )}
            {textField(
              "audience",
              "For whom",
              "optional",
              "e.g. Busy founders",
            )}
          </div>
          {textField(
            "context",
            "Helpful context",
            "optional",
            "Background, relevant facts, examples, or anything AI should know...",
            3,
          )}
          <div className="field-row">
            <GuidanceSelect
              id="format"
              label="Output format"
              placeholder="Choose a format"
              options={formats}
              value={guidance.format || ""}
              onChange={(value) => update("format", value)}
            />
            <GuidanceSelect
              id="tone"
              label="Tone"
              placeholder="Choose a tone"
              options={tones}
              value={guidance.tone || ""}
              onChange={(value) => update("tone", value)}
            />
          </div>
          {textField(
            "approach",
            "Suggested flow",
            "for multi-step work",
            "e.g. Define the goal, compare options, then recommend next steps",
            3,
          )}
          {textField(
            "focus",
            "What should AI emphasize?",
            "highest priority first",
            "e.g. Practical first steps, likely obstacles, and how to measure progress",
            3,
          )}
          <GuidanceSelect
            id="depth"
            label="Answer depth"
            placeholder="Choose depth"
            options={depths}
            value={guidance.depth || ""}
            onChange={(value) => update("depth", value)}
          />
          {textField(
            "constraints",
            "Must include / avoid",
            "optional",
            "e.g. Keep it under 200 words. Avoid jargon. Include a call to action.",
            2,
          )}
          <div className="field-row">
            <GuidanceSelect
              id="researchMode"
              label="Live web research"
              placeholder="Auto (smart detection)"
              options={[
                "Auto (smart detection)",
                "Always research web",
                "No research (offline)",
              ]}
              value={
                researchMode === "on"
                  ? "Always research web"
                  : researchMode === "off"
                    ? "No research (offline)"
                    : "Auto (smart detection)"
              }
              onChange={(value) => {
                if (setResearchMode) {
                  setResearchMode(
                    value === "Always research web"
                      ? "on"
                      : value === "No research (offline)"
                        ? "off"
                        : "auto",
                  );
                }
              }}
            />
            <div className="field">
              <label htmlFor="referenceUrl">
                Reference URL / Docs <span className="optional">optional</span>
              </label>
              <input
                id="referenceUrl"
                type="url"
                value={referenceUrl}
                placeholder="e.g. https://docs.stripe.com/api"
                onChange={(event) => setReferenceUrl?.(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      <div className="idea-footer">
        <Button
          variant="primary"
          className="idea-generate"
          disabled={busy || (idea.trim().length < 4 && imageCount === 0)}
          onClick={generate}
        >
          <span aria-hidden="true">✦</span>{" "}
          {busy ? "Shaping your prompt…" : "Turn idea into prompt"}{" "}
          <span className="button-arrow">↗</span>
        </Button>
        <span role="status">
          {status ||
            (idea.trim().length >= 4 || imageCount
              ? "Ready to shape your prompt"
              : "Add your idea to begin")}
        </span>
      </div>
    </section>
  );
}
