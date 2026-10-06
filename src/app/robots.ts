import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_URL || "https://thepromptdock.vercel.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
    sitemap: `${origin}/sitemap.xml`,
  };
}
