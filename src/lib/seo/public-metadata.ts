import type { Metadata } from "next";

export function publicMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const fullTitle = `${title} — PromptDock`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: fullTitle,
      description,
      url: path,
      siteName: "PromptDock",
      images: [
        {
          url: "/social-card.png",
          width: 1200,
          height: 630,
          alt: "PromptDock",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/social-card.png"],
    },
  };
}
