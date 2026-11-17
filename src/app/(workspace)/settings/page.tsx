import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { session } from "@/lib/server/session";
import AiProviderSettings from "@/components/settings/AiProviderSettings";
import ProfileSettings from "@/components/settings/ProfileSettings";
import PublicProfileSettings from "@/components/settings/PublicProfileSettings";
import UsageSettings from "@/components/settings/UsageSettings";
import Masonry from "@/components/ui/Masonry";

export const metadata: Metadata = {
  title: "Settings",
  alternates: { canonical: "/settings" },
  robots: { index: false },
};

export default async function SettingsPage() {
  const account = await session();
  if (!account) redirect("/auth?mode=login");
  return (
    <div className="settings-view react-settings-page">
      <div className="page-intro">
        <div>
          <h1>
            Make it <em>yours.</em>
          </h1>
          <p>
            Your public profile, the AI behind your prompts, and how you sign
            in, all in one place.
          </p>
        </div>
      </div>
      <nav className="settings-jump" aria-label="Settings sections">
        <a href="#profile">Profile</a>
        <a href="#ai-provider">AI provider</a>
        <a href="#account">Sign-in &amp; security</a>
        <a href="#usage">Usage</a>
      </nav>
      <div className="settings-public-profile-section">
        <PublicProfileSettings />
      </div>
      <Masonry
        className="settings-grid react-settings-grid"
        minColumnWidth={420}
      >
        <AiProviderSettings />
        <ProfileSettings user={account.user} admin={account.admin} />
        <UsageSettings />
      </Masonry>
    </div>
  );
}
