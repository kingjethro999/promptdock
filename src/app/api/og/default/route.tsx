import { ImageResponse } from "next/og";
import { ogResponse } from "@/lib/og/respond";
import { Card } from "@/lib/og/Card";
import { pickLook } from "@/lib/og/themes";
import { getFonts } from "@/lib/og/fonts";
import { OG_SIZE, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const CACHE =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

async function render(req: Request) {
  const fonts = await getFonts();
  const look = pickLook("default", new URL(req.url).searchParams.get("s"));
  const domain = SITE_URL.replace(/^https?:\/\//, "");

  return new ImageResponse(
    <Card
      {...look}
      eyebrow="Your prompt workspace"
      title="Make more of your first thought."
      body="Type or say your idea. PromptDock turns it into a clear prompt, shows what it changed, and keeps it ready to reuse."
      footer={domain}
    />,
    {
      ...OG_SIZE,
      fonts,
      headers: {
        "Cache-Control": CACHE,
      },
    },
  );
}

export function GET(req: Request): Promise<Response> {
  return ogResponse(() => render(req));
}
