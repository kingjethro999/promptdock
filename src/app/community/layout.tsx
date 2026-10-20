import { AdaptiveShell } from "@/components/community/AdaptiveShell";
import type { Metadata } from "next";

const title = "PromptDock Community — Discover & Remix Public Prompts";
const description =
  "Explore prompts shared by the PromptDock community. Find ideas worth building on, save what works, and remix prompts into something new.";
const image = "/api/og/default";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/community" },
  openGraph: {
    type: "website",
    siteName: "PromptDock",
    locale: "en_US",
    title: "PromptDock Community",
    description,
    url: "/community",
    images: [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: "PromptDock Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptDock Community",
    description,
    images: [image],
  },
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
