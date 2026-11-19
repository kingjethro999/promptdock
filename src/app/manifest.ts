import type { MetadataRoute } from "next";

/**
 * The installed app opens on the sign-in screen; people who are already
 * signed in are sent straight on to their workspace from there.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=promptdock",
    name: "PromptDock",
    short_name: "PromptDock",
    description:
      "Turn rough ideas into prompts that work, and see what changed and why.",
    start_url: "/auth?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f8f3",
    theme_color: "#182824",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "New prompt", url: "/workspace" },
      { name: "Library", url: "/library" },
    ],
  };
}
