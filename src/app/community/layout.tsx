import { AdaptiveShell } from "@/components/community/AdaptiveShell";
import type { Metadata } from "next";

const title = "AI Prompt Community — Discover & Remix Prompts";
const description =
  "Discover, save, and remix reusable AI prompts shared by the PromptDock community. Find prompt ideas for ChatGPT, Claude, Gemini, and other AI tools.";
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
