import type { MetadataRoute } from "next";
import { siteUpdates } from "@/lib/server/public-data";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = SITE_URL;
  const pages = [
    "",
    "community",
    "updates",
    "privacy",
    "terms",
    "copyright",
  ].map((path) => ({ url: `${origin}/${path}` }));
  const updates = await siteUpdates().catch(() => []);
  return [
    ...pages,
    ...updates.map((item) => ({
      url: `${origin}/updates/${encodeURIComponent(item.id)}`,
    })),
  ];
}
