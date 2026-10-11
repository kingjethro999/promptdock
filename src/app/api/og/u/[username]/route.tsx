import { ImageResponse } from "next/og";
import { Card } from "@/lib/og/Card";
import { getFonts } from "@/lib/og/fonts";
import { clean, initial } from "@/lib/og/text";
import { OG_SIZE, SITE_URL } from "@/lib/site";
import { getUserByHandle, getPublicProfile } from "@/lib/community/queries";

export const runtime = "nodejs";
const CACHE =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const SHORT = "public, max-age=60, s-maxage=300";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const fonts = await getFonts();
  const domain = SITE_URL.replace(/^https?:\/\//, "");

  const target = await getUserByHandle(username).catch(() => null);
  const profile = target
    ? await getPublicProfile(target.id, null).catch(() => null)
    : null;

  if (!profile) {
    return new ImageResponse(
      <Card
        eyebrow="PromptDock Creator"
        title="PromptDock Creator Profile"
        body="Discover and remix prompts shared by PromptDock creators."
        footer={domain}
      />,
      {
        ...OG_SIZE,
        fonts,
        headers: { "Cache-Control": SHORT, "x-og-variant": "fallback" },
      },
    );
  }

  return new ImageResponse(
    <Card
      eyebrow={`@${clean(profile.username, 30)}`}
      title={clean(profile.displayName, 50)}
      body={clean(
        profile.bio || "Explore prompts on PromptDock Community.",
        140,
      )}
      footer={`${domain}/${clean(profile.username, 30)}`}
      avatarFallback={initial(profile.displayName || profile.username)}
    />,
    {
      ...OG_SIZE,
      fonts,
      headers: { "Cache-Control": CACHE, "x-og-variant": "profile" },
    },
  );
}
