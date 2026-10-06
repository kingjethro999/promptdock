"use client";

import type { PromptData } from "@/lib/prompt/types";

const fields: { key: keyof PromptData; label: string; rows: number }[] = [
  { key: "task", label: "What the AI should do", rows: 3 },
  { key: "role", label: "Perspective", rows: 1 },
  { key: "audience", label: "Audience", rows: 1 },
  { key: "context", label: "Context", rows: 3 },
  { key: "format", label: "Format", rows: 1 },
  { key: "tone", label: "Tone", rows: 1 },
  { key: "approach", label: "Approach", rows: 3 },
  { key: "focus", label: "Focus", rows: 3 },
  { key: "depth", label: "Depth", rows: 1 },
  { key: "constraints", label: "Requirements", rows: 3 },
];

export default function PromptEditor({
  data,
  onChange,
}: {
  data: PromptData;
  onChange(field: keyof PromptData, value: string): void;
}) {
  return (
    <details className="react-prompt-editor">
      <summary>
        Edit prompt details <span aria-hidden="true">⌄</span>
      </summary>
      <p>
        Make the finished prompt your own. Changes appear in the prompt above as
        you edit.
      </p>
      <div className="react-field-grid">
        {fields.map(({ key, label, rows }) => (
          <label className="react-field" key={key}>
            <span>{label}</span>
            {rows > 1 ? (
              <textarea
                rows={rows}
                value={String(data[key] || "")}
                onChange={(event) => onChange(key, event.target.value)}
              />
            ) : (
              <input
                value={String(data[key] || "")}
                onChange={(event) => onChange(key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </details>
  );
}
