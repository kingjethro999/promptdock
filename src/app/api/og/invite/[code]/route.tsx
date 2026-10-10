import { ImageResponse } from "next/og";
import { Card } from "@/lib/og/Card";
import { getFonts } from "@/lib/og/fonts";
import { safeAvatar } from "@/lib/og/avatar";
import { clean, initial } from "@/lib/og/text";
import { OG_SIZE, SITE_URL } from "@/lib/site";
import { referrals } from "@/server/referrals";

export const runtime = "nodejs"; // DB access; Edge cannot run most drivers

const CACHE = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
const SHORT = "public, max-age=60, s-maxage=300"; // generic fallback: keep short so a late-created code can show up

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const fonts = await getFonts();
  const domain = SITE_URL.replace(/^https?:\/\//, "");

  let inviter: { username?: string | null; avatarUrl?: string | null } | null = null;
  try {
    inviter = await referrals.inviterFor(code);
  } catch {
    /* fall through to the generic card */
  }

  if (!inviter?.username) {
    // Never 404 the image and never hint that the code is invalid.
    return new ImageResponse(
      <Card
        eyebrow="Your prompt workspace"
        title="Write, organize and share your best prompts."
        body="Join PromptDock to write, organize and share prompts for any AI platform."
        footer={domain}
      />,
      { ...OG_SIZE, fonts, headers: { "Cache-Control": SHORT } },
    );
  }

  const name = clean(inviter.username, 40);
  const avatar = await safeAvatar(inviter.avatarUrl);
  return new ImageResponse(
    <Card
      eyebrow="You're invited"
      title={`${name} invited you to PromptDock`}
      body="Join their workspace to write, organize and share prompts."
      footer={`${domain}/invite/${clean(code, 24)}`}
      avatar={avatar}
      avatarFallback={initial(name)}
    />,
    { ...OG_SIZE, fonts, headers: { "Cache-Control": CACHE } },
  );
}
