import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    // Keep Next.js on releases that fix published security advisories.
    agentUpgrade: "security",
  },
  htmlLimitedBots:
    /Twitterbot|facebookexternalhit|WhatsApp|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot/i,
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
  async headers() {
    // The service worker must always be re-checked, or a fix to it could
    // take a day to reach people who installed the app.
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      ...["auth", "updates", "privacy", "terms", "copyright"].map((name) => ({
        source: `/${name}.html`,
        destination: `/${name}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
