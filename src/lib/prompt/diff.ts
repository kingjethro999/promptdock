/**
 * A small word-level diff for showing how a prompt moved between versions.
 * Prompts are short enough for a plain LCS table; very long pairs fall back
 * to comparing whole lines so the browser never builds a huge table.
 */

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

export type DiffSummary = {
  parts: DiffPart[];
  wordsBefore: number;
  wordsAfter: number;
  added: number;
  removed: number;
  /** Section headings ("Role:", "## Output", "Constraints") new in the after text. */
  newSections: string[];
};

const MAX_CELLS = 1_500_000;

function tokens(text: string): string[] {
  // Keep whitespace as its own token so the rebuilt text reads naturally.
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function lines(text: string): string[] {
  return text.split(/(?<=\n)/);
}

function lcs(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[at(i, j)] =
        a[i] === b[j]
          ? table[at(i + 1, j + 1)] + 1
          : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < n) push("removed", a[i++]);
  while (j < m) push("added", b[j++]);
  return parts;
}

/** Whitespace-only changes read as noise, so fold them into "same". */
function tidy(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (const part of parts) {
    // Dropping blank removals keeps the "after" text intact when read as
    // same + added, which is how the panel renders it.
    if (part.kind === "removed" && !part.text.trim()) continue;
    const kind = part.text.trim() ? part.kind : "same";
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += part.text;
    else out.push({ kind, text: part.text });
  }
  return out;
}

function countWords(text: string) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function headings(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split("\n")) {
    const match =
      line.match(/^\s*#{1,6}\s+(.{2,60}?)\s*$/) ||
      line.match(/^\s*([A-Z][A-Za-z /&-]{1,40}):\s*$/) ||
      line.match(/^\s*<([a-z_]{2,30})>\s*$/i) ||
      line.match(/^\s*\*\*([^*]{2,40})\*\*:?\s*$/);
    if (match) found.add(match[1].trim().toLowerCase());
  }
  return [...found];
}

export function diffPrompts(before: string, after: string): DiffSummary {
  const a = tokens(before);
  const b = tokens(after);
  const parts =
    (a.length + 1) * (b.length + 1) <= MAX_CELLS
      ? lcs(a, b)
      : lcs(lines(before), lines(after));
  const tidied = tidy(parts);
  let added = 0;
  let removed = 0;
  for (const part of tidied) {
    if (part.kind === "added") added += countWords(part.text);
    if (part.kind === "removed") removed += countWords(part.text);
  }
  const old = new Set(headings(before));
  return {
    parts: tidied,
    wordsBefore: countWords(before),
    wordsAfter: countWords(after),
    added,
    removed,
    newSections: headings(after).filter((heading) => !old.has(heading)),
  };
}
