import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { session } from "@/lib/server/session";
import AiProviderSettings from "@/components/settings/AiProviderSettings";
import ProfileSettings from "@/components/settings/ProfileSettings";
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
          <div className="eyebrow">
            <span className="eyebrow-star">✳</span> YOUR WORKSPACE
          </div>
          <h1>
            Make it <em>yours.</em>
          </h1>
          <p>Choose the AI behind your prompts and keep your account secure.</p>
        </div>
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
