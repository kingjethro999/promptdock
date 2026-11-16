"use client";

import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { PromptInterpretation } from "@/lib/prompt/types";

/**
 * Explains a refinement instead of only handing back a rewritten prompt:
 * what changed from the rough idea, why each change helps, and yes/no checks
 * the person can run against whatever the target AI sends back.
 *
 * The parent keys this card by document revision, so ticks reset whenever a
 * new prompt replaces the one being checked.
 */
export default function InterpretationCard({
  interpretation,
}: {
  interpretation: PromptInterpretation;
}) {
  const headingId = useId();
  const changes = interpretation.changes ?? [];
  const checks = interpretation.checks ?? [];
  const open = interpretation.missingDetails ?? [];
  const [ticked, setTicked] = useState<boolean[]>(() =>
    checks.map(() => false),
  );
  const [copied, setCopied] = useState("");
  const confirmed = ticked.filter(Boolean).length;
  const allConfirmed = checks.length > 0 && confirmed === checks.length;

  async function copyChecklist() {
    const text = [
      "Review your answer against this checklist. For each item, say yes or no and point to where it is met:",
      ...checks.map((check) => `- [ ] ${check}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(
        "Checklist copied. Paste it after the AI's answer to have it check its own work.",
      );
    } catch {
      setCopied("Copy unavailable. Select the checklist and copy it.");
    }
  }

  return (
    <section
      className="quality-card understanding-card"
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>Understanding your prompt</h3>
      {interpretation.goal && (
        <p className="understanding-goal">{interpretation.goal}</p>
      )}

      {changes.length > 0 ? (
        <div className="understanding-block">
          <h4>What changed and why</h4>
          <ol className="understanding-changes">
            {changes.map((change, index) => (
              <li key={`${index}-${change.what}`}>
                <span className="understanding-change-what">{change.what}</span>
                {change.why && (
                  <span className="understanding-change-why">{change.why}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        interpretation.focusAreas?.length > 0 && (
          <div className="understanding-block">
            <h4>What it focuses on</h4>
            <ul className="understanding-focus">
              {interpretation.focusAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
        )
      )}

      {checks.length > 0 && (
        <div className="understanding-block">
          <div className="understanding-check-head">
            <h4>Check the result</h4>
            <span
              className={`understanding-tally${allConfirmed ? " is-done" : ""}`}
              aria-live="polite"
            >
              {allConfirmed ? (
                <>
                  <Icon name="check" size={13} /> All met
                </>
              ) : (
                `${confirmed} of ${checks.length}`
              )}
            </span>
          </div>
          <p className="understanding-hint">
            Run the prompt, then tick each one the answer actually meets.
          </p>
          <ul className="understanding-checks">
            {checks.map((check, index) => (
              <li key={`${index}-${check}`}>
                <label className={ticked[index] ? "is-ticked" : undefined}>
                  <input
                    type="checkbox"
                    className="ui-check"
                    checked={Boolean(ticked[index])}
                    onChange={(event) => {
                      const value = event.target.checked;
                      setTicked((prev) =>
                        prev.map((item, i) => (i === index ? value : item)),
                      );
                    }}
                  />
                  <span>{check}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="understanding-actions">
            <Button variant="quiet" size="sm" onClick={copyChecklist}>
              <Icon name="copy" size={14} /> Copy checklist
            </Button>
            {confirmed > 0 && (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setTicked(checks.map(() => false))}
              >
                Clear ticks
              </Button>
            )}
          </div>
          {copied && (
            <p className="understanding-hint" role="status">
              {copied}
            </p>
          )}
        </div>
      )}

      {open.length > 0 && (
        <div className="understanding-block">
          <h4>Still yours to decide</h4>
          <ul className="understanding-open">
            {open.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
