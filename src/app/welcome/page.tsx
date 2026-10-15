import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getViewer, safeReturnTo } from "@/lib/community/viewer";
import { ONBOARDING_EPOCH, PROFILE_FLOW_ID } from "@/lib/onboarding/registry";
import { ProfileSetup } from "@/components/profile-setup/ProfileSetup";
import type { Draft } from "@/components/profile-setup/types";

const db = require("../../database");

export const metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`/auth?mode=login&returnTo=${encodeURIComponent("/welcome")}`);
  }

  await db.ensureSchema();
  const nextParam = (await searchParams).next;
  const next = safeReturnTo(nextParam ?? null, "/");

  const [userRes, expRes] = await Promise.all([
    db.pool.query(
      `SELECT username, display_name, avatar_url, banner_url, banner_preset, bio, created_at
       FROM users WHERE id = $1::uuid`,
      [viewer.id],
    ),
    db.pool.query(
      `SELECT experience_id, status FROM user_experiences WHERE user_id = $1::uuid`,
      [viewer.id],
    ),
  ]);

  const user = userRes.rows[0];
  if (!user) {
    redirect(`/auth?mode=login&returnTo=${encodeURIComponent("/welcome")}`);
  }

  const rows = expRes.rows;
  const isNewAccount = new Date(user.created_at) >= new Date(ONBOARDING_EPOCH);
  const mode =
    isNewAccount &&
    !rows.some(
      (r: { experience_id: string }) => r.experience_id === PROFILE_FLOW_ID,
    )
      ? "signup"
      : "edit";

  const initial: Draft = {
    displayName: user.display_name || user.username || "",
    avatar: user.avatar_url
      ? {
          kind: "image",
          source: "upload",
          id: "initial",
          blob: new Blob(),
          previewUrl: user.avatar_url,
        }
      : { kind: "none" },
    banner: user.banner_url
      ? {
          kind: "image",
          id: "initial",
          blob: new Blob(),
          previewUrl: user.banner_url,
        }
      : user.banner_preset
        ? { kind: "preset", id: user.banner_preset }
        : { kind: "none" },
    bio: user.bio || "",
  };

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "promptdock.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const siteHost = `${protocol}://${host}`;

  return (
    <ProfileSetup
      mode={mode}
      next={next}
      username={user.username || "user"}
      initial={initial}
      siteHost={siteHost}
    />
  );
}
