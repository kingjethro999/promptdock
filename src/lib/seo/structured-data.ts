export function homeStructuredData(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        url: `${origin}/`,
        name: "PromptDock",
        description:
          "Turn rough or spoken ideas into structured prompts you can save, reuse, and share with any AI tool.",
        inLanguage: "en",
        publisher: {
          "@type": "Organization",
          name: "PromptDock",
          url: `${origin}/`,
          logo: { "@type": "ImageObject", url: `${origin}/favicon.svg` },
          founder: {
            "@type": "Person",
            name: "King Jethro",
            url: "https://github.com/kingjethro999",
          },
          sameAs: [
            "https://github.com/kingjethro999/promptdock",
            "https://www.tiktok.com/@thepromptdock",
          ],
        },
      },
      {
        "@type": "WebApplication",
        name: "PromptDock",
        url: `${origin}/`,
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        inLanguage: "en",
        description:
          "An idea-to-prompt workspace that turns rough ideas into clear prompts you can reuse on any AI platform.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

export function sharedPromptStructuredData({
  origin,
  publicId,
  name,
  description,
  ownerUsername,
  updatedAt,
}: {
  origin: string;
  publicId: string;
  name: string;
  description: string;
  ownerUsername: string | null;
  updatedAt: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url: `${origin}/p/${encodeURIComponent(publicId)}`,
    dateModified: updatedAt,
    isAccessibleForFree: true,
    inLanguage: "en",
    ...(ownerUsername
      ? { author: { "@type": "Person", name: ownerUsername } }
      : {}),
  };
}
