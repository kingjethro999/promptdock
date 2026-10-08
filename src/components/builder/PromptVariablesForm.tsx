"use client";

import { useMemo } from "react";
import { extractPromptVariables } from "@/lib/prompt/variables";

type Props = {
  promptText: string;
  values: Record<string, string>;
  onChange(field: string, value: string): void;
  onReset(): void;
  enabled: boolean;
  onToggle(enabled: boolean): void;
};

export default function PromptVariablesForm({
  promptText,
  values,
  onChange,
  onReset,
  enabled,
  onToggle,
}: Props) {
  const variables = useMemo(
    () => extractPromptVariables(promptText),
    [promptText],
  );

  if (!variables.length) return null;

  return (
    <div
      className="prompt-variables-panel"
      role="region"
      aria-label="Prompt variables"
    >
      <div className="variables-header">
        <div className="variables-title-wrap">
          <span className="variables-icon" aria-hidden="true">
            ⚙
          </span>
          <div>
            <div className="variables-title">
              Dynamic Variables ({variables.length})
            </div>
            <div className="variables-subtitle">
              Fill in placeholder values to preview and test with real data
            </div>
          </div>
        </div>
        <div className="variables-actions">
          <button
            type="button"
            className={`variables-toggle-btn${enabled ? " is-active" : ""}`}
            onClick={() => onToggle(!enabled)}
          >
            {enabled ? "✓ Using custom values" : "Insert values"}
          </button>
          {enabled && (
            <button
              type="button"
              className="variables-reset-btn"
              onClick={onReset}
              title="Reset all variable values"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {enabled && (
        <div className="variables-fields-grid">
          {variables.map((variable) => (
            <div key={variable} className="variable-field">
              <label htmlFor={`var-${variable}`}>
                <code>{"{{" + variable + "}}"}</code>
              </label>
              <input
                id={`var-${variable}`}
                type="text"
                value={values[variable] || ""}
                placeholder={`Value for ${variable}...`}
                onChange={(e) => onChange(variable, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
