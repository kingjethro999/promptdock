export type Finding = {
  id: string;
  label: string;
  severity: "block" | "warn";
};

const RULES = [
  {
    id: "private-key",
    label: "a private key",
    severity: "block",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    id: "groq",
    label: "a Groq API key",
    severity: "block",
    re: /\bgsk_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: "google",
    label: "a Google API key",
    severity: "block",
    re: /\bAIza[0-9A-Za-z_-]{30,}\b/,
  },
  {
    id: "key-like",
    label: "an API key",
    severity: "block",
    re: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "github",
    label: "a GitHub token",
    severity: "block",
    re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
  {
    id: "email",
    label: "an email address",
    severity: "warn",
    re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  },
] as const;

const strings = (v: unknown): string[] =>
  typeof v === "string"
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(strings)
      : v && typeof v === "object"
        ? Object.values(v).flatMap(strings)
        : [];

export function scanPrompt(p: {
  name?: string;
  tags?: string[];
  data?: unknown;
}): Finding[] {
  const text = [p.name ?? "", ...(p.tags ?? []), ...strings(p.data)].join("\n");
  return RULES.filter((r) => r.re.test(text)).map(
    ({ id, label, severity }) => ({
      id,
      label,
      severity,
    }),
  );
}
