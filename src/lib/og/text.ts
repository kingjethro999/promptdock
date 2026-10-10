/** Collapse whitespace, strip control chars, clamp by characters. */
export function clean(input: unknown, max: number): string {
  const s = String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export const initial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();
