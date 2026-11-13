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
