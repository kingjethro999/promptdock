import type { Metadata } from "next";
import { OG_DEFAULT_IMAGE } from "@/lib/site";

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
      images: [{ ...OG_DEFAULT_IMAGE, alt: "PromptDock" }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_DEFAULT_IMAGE.url],
    },
  };
}
