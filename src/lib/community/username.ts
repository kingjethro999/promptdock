export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;
export const normalizeUsername = (s: string) => (s ?? "").trim().toLowerCase();

// Top-level route tree segments, API endpoints, and impersonation bait
export const RESERVED = new Set([
  "community",
  "login",
  "signup",
  "sign-in",
  "sign-up",
  "logout",
  "settings",
  "workspace",
  "library",
  "prompts",
  "prompt",
  "api",
  "invite",
  "p",
  "share",
  "new",
  "admin",
  "support",
  "help",
  "about",
  "pricing",
  "terms",
  "privacy",
  "docs",
  "blog",
  "assets",
  "static",
  "promptdock",
  "thepromptdock",
  "official",
  "staff",
  "team",
  "moderator",
  "root",
  "me",
  "you",
  "www",
  "null",
  "undefined",
  "auth",
  "updates",
  "copyright",
  "feed",
  "feed.xml",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "favicon.svg",
]);

export function validateUsername(raw: string) {
  const value = normalizeUsername(raw);
  if (!USERNAME_RE.test(value) || /[-_]{2}/.test(value)) {
    return { ok: false as const, reason: "format" as const };
  }
  if (RESERVED.has(value)) {
    return { ok: false as const, reason: "reserved" as const };
  }
  return { ok: true as const, value };
}

export function usernameBase(src: {
  providerLogin?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  const raw =
    src.providerLogin || src.name || src.email?.split("@")[0] || "creator";
  const base = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base.length < 3 || RESERVED.has(base) ? "creator" : base;
}

/** Deterministic avatar tone based on existing design palette tokens. */
export function avatarFallback(username: string, tones = 6) {
  let h = 0;
  for (const ch of username || "?") {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return {
    letter: ((username || "?").trim()[0] ?? "?").toUpperCase(),
    tone: h % tones,
  };
}
