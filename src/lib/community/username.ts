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
  "c",
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
  "dev",
  "updates",
  "copyright",
  "welcome",
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

const TONE_COLORS = [
  "#1d3a2c",
  "#5e7467",
  "#6b7c3f",
  "#3d5a47",
  "#4a5e54",
  "#7a8b6a",
];

/** Default deterministic avatar SVG data URI fallback for users with no profile picture (zero network, instant, reliable). */
export function defaultAvatarDataUri(identifier: string, size = 256): string {
  const fallback = avatarFallback(identifier);
  const bg = TONE_COLORS[fallback.tone % TONE_COLORS.length];
  const fontSize = Math.round(size * 0.46);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" rx="${size / 2}" fill="${bg}"/>` +
    `<text x="50%" y="54%" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${fallback.letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Backward-compatible alias for default avatar URL. Returns a deterministic SVG data URI instead of external Gravatar. */
export function getGravatarUrl(identifier: string, size = 256): string {
  return defaultAvatarDataUri(identifier, size);
}
