import type { MetadataRoute } from "next";
import { siteUpdates } from "@/lib/server/public-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_URL || "https://thepromptdock.vercel.app";
  const pages = ["", "updates", "privacy", "terms", "copyright"].map(
    (path) => ({
      url: `${origin}/${path}`,
    }),
  );
  const updates = await siteUpdates().catch(() => []);
  return [
    ...pages,
    ...updates.map((item) => ({
      url: `${origin}/updates/${encodeURIComponent(item.id)}`,
    })),
  ];
}
