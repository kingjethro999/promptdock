import { ImageResponse } from "next/og";
import { ogResponse } from "@/lib/og/respond";
import { Card } from "@/lib/og/Card";
import { getFonts } from "@/lib/og/fonts";
import { OG_SIZE, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const CACHE =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

async function render() {
  const fonts = await getFonts();
  const domain = SITE_URL.replace(/^https?:\/\//, "");

  return new ImageResponse(
    <Card
      eyebrow="Your prompt workspace"
      title="Make more of your first thought."
      body="Turn rough or spoken ideas and image references into structured prompts you can save, reuse, and share with any AI tool."
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

export function GET(): Promise<Response> {
  return ogResponse(render);
}
