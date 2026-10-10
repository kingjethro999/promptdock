import { ImageResponse } from "next/og";
import { Card } from "@/lib/og/Card";
import { getFonts } from "@/lib/og/fonts";
import { clean, initial } from "@/lib/og/text";
import { OG_SIZE, SITE_URL } from "@/lib/site";
import { database } from "@/server/database";

export const runtime = "nodejs";
const CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const SHORT = "public, max-age=60, s-maxage=300";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const fonts = await getFonts();
  const domain = SITE_URL.replace(/^https?:\/\//, "");

  let prompt: Awaited<ReturnType<typeof database.getPublicPrompt>> | null = null;
  try {
    prompt = await database.getPublicPrompt(publicId);
  } catch {}

  if (!prompt) {
    return new ImageResponse(
      <Card
        eyebrow="Shared prompt"
        title="A prompt shared on PromptDock"
        body="Explore prompts structured for any AI platform. Create, organize and share your own."
        footer={domain}
      />,
      { ...OG_SIZE, fonts, headers: { "Cache-Control": SHORT } },
    );
  }

  const owner = clean(prompt.ownerUsername, 40);
  return new ImageResponse(
    <Card
      eyebrow={owner ? `Shared by ${owner}` : "Shared prompt"}
      title={clean(prompt.name, 90)}
      body={clean(prompt.data?.task, 180)}
      footer={`${domain}/p/${clean(publicId, 24)}`}
      avatarFallback={owner ? initial(owner) : undefined}
    />,
    { ...OG_SIZE, fonts, headers: { "Cache-Control": CACHE } },
  );
}
