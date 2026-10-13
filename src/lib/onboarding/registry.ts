import type { Experience } from "./types";

export const ONBOARDING_EPOCH = "2026-10-12T00:00:00Z";
export const PROFILE_FLOW_ID = "profile-setup-v1";
export const FLOWS = [{ id: PROFILE_FLOW_ID, steps: 5 }] as const;

export const EXPERIENCES: Experience[] = [
  {
    id: "welcome-v1",
    type: "welcome",
    priority: 100,
    publishedAt: ONBOARDING_EPOCH,
    title: "Welcome to PromptDock",
    summary: "A quick look around your workspace.",
    audience: { createdAfter: ONBOARDING_EPOCH },
    steps: [
      {
        id: "hello",
        kind: "modal",
        title: "Welcome to PromptDock",
        body: "Start with a rough idea. PromptDock turns it into a clear prompt you can use in any AI tool. Here is a quick look around.",
        media: "wireframe-composer",
      },
      {
        id: "composer",
        kind: "spotlight",
        target: "composer",
        placement: "bottom",
        title: "Start here",
        body: "Type or dictate a rough thought. PromptDock finds the goal and the priorities for you.",
      },
      {
        id: "library",
        kind: "spotlight",
        target: "nav-library",
        placement: "right",
        title: "Your library",
        body: "Prompts you save live here. They stay private unless you choose to share them.",
        compact: { prepare: "open-sidebar" },
      },
      {
        id: "community",
        kind: "spotlight",
        target: "nav-community",
        placement: "right",
        title: "Community",
        body: "Browse prompts other people chose to share. Copy one, save it, or remix it into your own.",
        compact: { prepare: "open-sidebar" },
      },
      {
        id: "keys",
        kind: "spotlight",
        target: "nav-settings",
        placement: "right",
        title: "Use your own AI key",
        body: "Add a provider key in Settings to run prompts here. Keys are encrypted and never shown again.",
        compact: { prepare: "open-sidebar" },
        cta: { label: "Start with an idea", focus: "composer" },
      },
    ],
  },
  {
    id: "release-2026-10-community",
    type: "release",
    priority: 50,
    publishedAt: "2026-10-12T00:00:00Z",
    title: "Community is here",
    summary:
      "Discover prompts other people share, and follow the people behind them.",
    steps: [
      {
        id: "intro",
        kind: "modal",
        title: "Community is here",
        media: "wireframe-community",
        body: "Discover prompts other people chose to share, save the ones you like, and follow their creators. Nothing of yours is public unless you decide.",
      },
      {
        id: "sidebar",
        kind: "spotlight",
        target: "nav-community",
        placement: "right",
        title: "Find it in the sidebar",
        body: "Search by tag, copy a prompt, or remix it into something of your own.",
        compact: { prepare: "open-sidebar" },
      },
      {
        id: "profile",
        kind: "modal",
        title: "You have a public profile",
        body: "Your address is {{username}}. Change it, add a photo or banner, and choose who can see your prompts.",
        cta: { label: "Open profile settings", href: "/settings#profile" },
      },
    ],
  },
];
