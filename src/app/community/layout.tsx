import { AdaptiveShell } from "@/components/community/AdaptiveShell";
import type { Metadata } from "next";

import { randomCard } from "@/lib/site";

const title = "Community prompts to discover, save, and remix";
const description =
  "Browse prompts people actually use, then save or remix them for ChatGPT, Claude, Gemini, and whatever else you work with. Follow creators you like.";

export function generateMetadata(): Metadata {
  // Static files from the CDN (crawler-friendly), one picked per request.
  const image = randomCard().url;
  return {
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
          type: "image/png",
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
}

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdaptiveShell>{children}</AdaptiveShell>;
}
