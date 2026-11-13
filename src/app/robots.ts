import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Social-card images live under /api/og/. Twitterbot and other preview
        // crawlers obey robots.txt, so they must be allowed past the /api/ rule.
        allow: ["/", "/api/og/"],
        disallow: [
          "/api/",
          "/admin",
          "/settings",
          "/library",
          "/workspace",
          "/auth",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
