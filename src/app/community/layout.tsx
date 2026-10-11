import { AdaptiveShell } from "@/components/community/AdaptiveShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PromptDock Community — Discover & Remix Public Prompts",
  description:
    "Explore prompts shared by the PromptDock community. Find ideas worth building on, copy them for any AI platform, and remix them into your own library.",
  alternates: { canonical: "/community" },
  openGraph: {
    title: "PromptDock Community",
    description:
      "Explore prompts shared by the PromptDock community. Find ideas worth building on, save what works, and remix prompts into something new.",
    url: "/community",
  },
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
