export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "PromptDock";
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Absolute URL for an OG image, with a cache-busting version. */
export const ogUrl = (path: string, version?: string | number) =>
  `${path}${version ? `?v=${version}` : ""}`;
