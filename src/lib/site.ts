export const SITE_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://thepromptdock.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "PromptDock";
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Absolute URL for an OG image, with a cache-busting version. */
export const ogUrl = (path: string, version?: string | number) =>
  `${path}${version ? `?v=${version}` : ""}`;

/**
 * The static social card. Link-preview crawlers get a plain file from the CDN:
 * no function cold start, and no dependence on /api/ being crawlable.
 * Regenerate it from /api/og/default when the brand card changes.
 */
export const OG_DEFAULT_IMAGE = {
  url: "/og-default.png",
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  type: "image/png",
} as const;

/**
 * Pre-rendered static cards, one per theme, generated from
 * /api/og/default?s=<seed>. Home and community pick one at random per page
 * request, so a shared link gets a different card while crawlers still fetch
 * a plain CDN file.
 */
export const OG_ROTATING_IMAGES = [1, 2, 3, 4, 5, 6].map((n) => ({
  url: `/og/card-${n}.png`,
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  type: "image/png",
}));

export const randomCard = () =>
  OG_ROTATING_IMAGES[Math.floor(Math.random() * OG_ROTATING_IMAGES.length)];

export const SITE_TITLE = `${SITE_NAME}: turn rough ideas into prompts that work`;
export const SITE_DESCRIPTION =
  "Say what you want in your own words, messy is fine. PromptDock shapes it into a clear prompt, shows what it changed and how to check the answer, and keeps it in a library you can share.";
