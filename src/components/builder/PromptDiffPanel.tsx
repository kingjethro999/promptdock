"use client";

import { useId, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { diffPrompts, type DiffPart } from "@/lib/prompt/diff";
import type { PromptChange } from "@/lib/prompt/types";
import type { PromptBaseline } from "@/stores/prompt-builder";

/**
 * Answers "what did this version actually change?" Collapsed, it is one line
 * with the size of the change. Open, it lists each upgrade with its reason
 * and shows the two texts side by side with the moved words marked.
 */
export default function PromptDiffPanel({
  baseline,
  prompt,
  changes = [],
  defaultOpen = false,
}: {
  baseline: PromptBaseline | null;
  prompt: string;
  changes?: PromptChange[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const summary = useMemo(
    () => (baseline && prompt ? diffPrompts(baseline.text, prompt) : null),
    [baseline, prompt],
  );
  if (!baseline || !summary || !prompt.trim()) return null;

  const fromLabel =
    baseline.kind === "previous" ? "Previous version" : "What you wrote";
  const title =
    baseline.kind === "previous"
      ? "What changed from the previous version"
      : "What changed from what you wrote";
  const delta = summary.wordsAfter - summary.wordsBefore;
  const facts = [
    `${summary.wordsBefore} → ${summary.wordsAfter} words`,
    delta === 0 ? null : `${delta > 0 ? "+" : ""}${delta}`,
    summary.newSections.length
      ? `${summary.newSections.length} new section${summary.newSections.length === 1 ? "" : "s"}`
      : null,
    changes.length
      ? `${changes.length} upgrade${changes.length === 1 ? "" : "s"} explained`
      : null,
  ].filter(Boolean);

  return (
    <section className={`diff-panel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="diff-panel__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <Icon name="info" size={16} className="diff-panel__icon" />
        <span className="diff-panel__title">{title}</span>
        <span className="diff-panel__facts">{facts.join(" · ")}</span>
        <Icon name="chevron-down" size={16} className="diff-panel__chevron" />
      </button>
      {open && (
        <div className="diff-panel__body" id={bodyId}>
          {changes.length > 0 && (
            <ol className="diff-panel__upgrades">
              {changes.map((change, index) => (
                <li key={`${change.what}-${index}`}>
                  <strong>{change.what}</strong>
                  {change.why && <span>{change.why}</span>}
                </li>
              ))}
            </ol>
          )}
          {summary.newSections.length > 0 && (
            <p className="diff-panel__sections">
              New sections:{" "}
              {summary.newSections.map((name) => (
                <span key={name} className="diff-panel__tag">
                  {name}
                </span>
              ))}
            </p>
          )}
          <div className="diff-panel__texts">
            <DiffText
              label={fromLabel}
              parts={summary.parts}
              show="removed"
              note={
                summary.removed
                  ? `${summary.removed} words dropped or reworded`
                  : "Nothing dropped"
              }
            />
            <DiffText
              label="New prompt"
              parts={summary.parts}
              show="added"
              note={
                summary.added ? `${summary.added} words added` : "Nothing added"
              }
            />
          </div>
          <p className="diff-panel__legend">
            <ins>Highlighted</ins> words are new. <del>Struck</del> words were
            removed or reworded.
          </p>
        </div>
      )}
    </section>
  );
}

function DiffText({
  label,
  parts,
  show,
  note,
}: {
  label: string;
  parts: DiffPart[];
  show: "added" | "removed";
  note: string;
}) {
  return (
    <figure className={`diff-text diff-text--${show}`}>
      <figcaption>
        <span>{label}</span>
        <span className="diff-text__note">{note}</span>
      </figcaption>
      <div className="diff-text__body" tabIndex={0}>
        {parts.map((part, index) => {
          if (part.kind === "same") return <span key={index}>{part.text}</span>;
          if (part.kind !== show) return null;
          return show === "added" ? (
            <ins key={index}>{part.text}</ins>
          ) : (
            <del key={index}>{part.text}</del>
          );
        })}
      </div>
    </figure>
  );
}
