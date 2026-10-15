const CTRL =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const BLOCKED_NAMES = new Set([
  "promptdock",
  "thepromptdock",
  "promptdockteam",
  "promptdocksupport",
  "official",
  "admin",
  "administrator",
  "staff",
  "support",
  "moderator",
  "system",
]);

const cp = (s: string) => [...s].length;

export type NameResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: "too_long" | "reserved" | "invalid" };

export function cleanDisplayName(raw: unknown): NameResult {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "invalid" };
  const v = raw.replace(CTRL, "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: true, value: null };
  if (cp(v) > 60) return { ok: false, reason: "too_long" };
  if (BLOCKED_NAMES.has(v.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true, value: v };
}

export function cleanBio(
  raw: unknown,
):
  | { ok: true; value: string | null }
  | { ok: false; reason: "too_long" | "invalid" } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, reason: "invalid" };
  const v = raw
    .replace(CTRL, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!v) return { ok: true, value: null };
  return cp(v) > 160
    ? { ok: false, reason: "too_long" }
    : { ok: true, value: v };
}

export const NAME_MESSAGES = {
  too_long: "That name is a little long.",
  reserved: "That name can't be used.",
  invalid: "That name can't be used.",
} as const;
