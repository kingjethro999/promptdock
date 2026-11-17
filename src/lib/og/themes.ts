// Social-card themes. A share link carries a seed (?s=) so each share can get
// a different look, while one URL always renders the same card for caches.
// Satori needs literal colors: no CSS variables here.

export type CardKind =
  "prompt" | "profile" | "collection" | "invite" | "default";

export type OgTheme = {
  id: string;
  bg: string;
  bgImage?: string;
  fg: string;
  muted: string;
  accent: string;
  /** Ink used on top of the accent (sticker text). */
  onAccent: string;
  rule: string;
  markBg: string;
  markFg: string;
  /** Decorative shapes drawn behind the content. */
  shapes: {
    left: number;
    top: number;
    size: number;
    color: string;
    radius?: number;
    rotate?: number;
    ring?: boolean;
  }[];
};

export const OG_THEMES: OgTheme[] = [
  {
    id: "night-lime",
    bg: "#0e1814",
    fg: "#f7f8f3",
    muted: "#a9bdb2",
    accent: "#d5f876",
    onAccent: "#0e1814",
    rule: "#23382e",
    markBg: "#182824",
    markFg: "#c7f464",
    shapes: [
      { left: 900, top: -140, size: 420, color: "#1d3a2c" },
      { left: 1010, top: 330, size: 150, color: "#d5f876", ring: true },
      { left: 1110, top: 520, size: 46, color: "#d5f876" },
    ],
  },
  {
    id: "paper",
    bg: "#f6f1e4",
    fg: "#1d2a25",
    muted: "#5b6b62",
    accent: "#ff6a3d",
    onAccent: "#fffaf0",
    rule: "#e2d9c3",
    markBg: "#1d2a25",
    markFg: "#d5f876",
    shapes: [
      {
        left: 930,
        top: 60,
        size: 230,
        color: "#ffd9c9",
        radius: 60,
        rotate: 14,
      },
      { left: 1040, top: 380, size: 120, color: "#1d2a25", ring: true },
      { left: 860, top: 330, size: 54, color: "#ff6a3d" },
    ],
  },
  {
    id: "lime-pop",
    bg: "#d5f876",
    fg: "#10200f",
    muted: "#3d5a2c",
    accent: "#10200f",
    onAccent: "#d5f876",
    rule: "#b6dd55",
    markBg: "#10200f",
    markFg: "#d5f876",
    shapes: [
      {
        left: 940,
        top: -80,
        size: 300,
        color: "#c3ea5c",
        radius: 80,
        rotate: -12,
      },
      { left: 1000, top: 360, size: 170, color: "#10200f", ring: true },
      { left: 880, top: 250, size: 40, color: "#ffffff" },
    ],
  },
  {
    id: "grape",
    bg: "#24163a",
    bgImage: "linear-gradient(135deg, #24163a 0%, #3a1f52 100%)",
    fg: "#fbf3ff",
    muted: "#c9b5dc",
    accent: "#ff8fd1",
    onAccent: "#24163a",
    rule: "#43305c",
    markBg: "#fbf3ff",
    markFg: "#24163a",
    shapes: [
      { left: 880, top: 40, size: 360, color: "#ff8fd1", ring: true },
      { left: 950, top: 110, size: 220, color: "#ffd36e", ring: true },
      { left: 1040, top: 470, size: 70, color: "#ffd36e" },
    ],
  },
  {
    id: "ocean",
    bg: "#082634",
    bgImage: "radial-gradient(circle at 85% 20%, #11475e 0%, #082634 60%)",
    fg: "#effbff",
    muted: "#a3c6d3",
    accent: "#7ce7ff",
    onAccent: "#082634",
    rule: "#17435a",
    markBg: "#7ce7ff",
    markFg: "#082634",
    shapes: [
      { left: 960, top: 300, size: 300, color: "#0f3e53" },
      { left: 900, top: 90, size: 90, color: "#7ce7ff", ring: true },
      { left: 1080, top: 200, size: 36, color: "#ffe28a" },
    ],
  },
  {
    id: "sunset",
    bg: "#ff7a59",
    bgImage: "linear-gradient(120deg, #ff7a59 0%, #ffb547 100%)",
    fg: "#2b1408",
    muted: "#5e3417",
    accent: "#2b1408",
    onAccent: "#ffd27a",
    rule: "#f39a4a",
    markBg: "#2b1408",
    markFg: "#ffd27a",
    shapes: [
      { left: 920, top: -60, size: 330, color: "#ffd27a" },
      { left: 1050, top: 390, size: 140, color: "#2b1408", ring: true },
      {
        left: 1090,
        top: 250,
        size: 60,
        color: "#fff4dc",
        radius: 16,
        rotate: 20,
      },
    ],
  },
];

/** Short, human sticker lines per kind. One is picked with the theme. */
const STICKERS: Record<CardKind, string[]> = {
  prompt: [
    "Copy it. Paste it. Done.",
    "Works in any AI chat",
    "Steal this prompt",
    "Tried, saved, shared",
    "Better answers inside",
  ],
  profile: [
    "Follow for good prompts",
    "Their prompts, your shortcut",
    "New prompts land here",
    "Come see what they made",
    "Worth a follow",
  ],
  collection: [
    "A whole playlist of prompts",
    "Press play on this set",
    "Curated, not dumped",
    "Grab the whole stack",
  ],
  invite: ["You're invited", "Saved you a seat", "Come build prompts with us"],
  default: [
    "Rough idea in, real prompt out",
    "Say it messy. Get it clear.",
    "Your prompts, kept in one place",
    "Works with every AI tool",
  ],
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Picks a theme and sticker line. With a seed the choice is stable for that
 * URL; without one it is random, so repeated shares look different.
 */
export function pickLook(kind: CardKind, seed?: string | null) {
  const n = seed
    ? hash(`${kind}:${seed}`)
    : Math.floor(Math.random() * 0xffffffff);
  const theme = OG_THEMES[n % OG_THEMES.length];
  const lines = STICKERS[kind];
  const sticker = lines[Math.floor(n / OG_THEMES.length) % lines.length];
  return { theme, sticker };
}

/** A fresh seed for a share URL. */
export const shareSeed = () => Math.random().toString(36).slice(2, 8);
