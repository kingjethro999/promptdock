import { ImageResponse } from "next/og";
import { Card } from "@/lib/og/Card";
import { getFonts } from "@/lib/og/fonts";
import { safeAvatar } from "@/lib/og/avatar";
import { clean, initial } from "@/lib/og/text";
import { OG_SIZE, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const eyebrow = clean(url.searchParams.get("eyebrow") || "Shared prompt", 40);
  const title = clean(url.searchParams.get("title") || "PromptDock", 120);
  const body = url.searchParams.has("body")
    ? clean(url.searchParams.get("body"), 180)
    : undefined;
  const footer = clean(
    url.searchParams.get("footer") || SITE_URL.replace(/^https?:\/\//, ""),
    40,
  );
  const avatarUrl = url.searchParams.get("avatar");
  const avatar = await safeAvatar(avatarUrl);
  const fallback =
    url.searchParams.get("fallback") || (title ? initial(title) : "?");

  const fonts = await getFonts();

  return new ImageResponse(
    <Card
      eyebrow={eyebrow}
      title={title}
      body={body}
      footer={footer}
      avatar={avatar}
      avatarFallback={fallback}
    />,
    {
      ...OG_SIZE,
      fonts,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
