import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  devIndicators: false,
  htmlLimitedBots:
    /Twitterbot|facebookexternalhit|WhatsApp|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot/i,
  env: { NEXT_PUBLIC_APP_VERSION: packageJson.version },
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
