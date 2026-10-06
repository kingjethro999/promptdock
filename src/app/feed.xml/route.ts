import { siteUpdates } from "@/lib/server/public-data";

const feed = require("../../feed") as {
  renderFeedXml(updates: unknown[], origin: string): string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = process.env.APP_URL || "https://thepromptdock.vercel.app";
  return new Response(feed.renderFeedXml(await siteUpdates(), origin), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
