module.exports = [
  {
    id: "interactive-research-drawer",
    version: "v0.9.7",
    date: "October 8, 2026",
    title: "Interactive research drawer & web grounding controls",
    summary:
      "Explore retrieved web sources directly in the prompt preview, ground ideas with explicit reference URLs, and control research modes.",
    body:
      "PromptDock now features an interactive Research Grounding Drawer inside the prompt preview. When live web research is used, you can explore the exact sources retrieved by Jina or Firecrawl, complete with page titles, source domain badges, publication dates, and excerpt snippets. Each source includes a direct link and one-click URL copy. You can now also paste explicit documentation or reference URLs directly in the fine-tune panel to ground prompt generation on exact APIs or specifications, and choose between Smart Detection (Auto), Always Research Web, or Offline knowledge modes.",
  },
  {
    id: "research-aware-refinement",
    version: "v0.9.3",
    date: "October 8, 2026",
    title: "Prompt refinement can now use live research",
    summary:
      "Research-aware refinement uses focused web sources when a request needs current or external information.",
    body: "PromptDock now detects when a request would benefit from current information, documentation, comparisons, or a supplied URL, then uses Firecrawl as an optional server-side research layer before the existing prompt architect runs. Retrieved sources are bounded, deduplicated, preserved by URL, treated as untrusted data, and reused during clarification follow-ups. Ordinary creative and transformation prompts continue through the normal refinement path, while unavailable research falls back gracefully without pretending that sources were used.",
  },
  {
    id: "image-to-prompt",
    version: "v0.7.5",
    date: "October 3, 2026",
    title: "Image to Prompt is here",
    summary:
      "Attach up to three images to an idea and turn what is visible into a detailed, reusable prompt.",
    body: "Image to Prompt now lets you attach JPEG, PNG, or WebP references alongside a typed or spoken idea. PromptDock uses a vision-capable model, asks focused follow-ups only when intent is unclear, and creates a self-contained prompt you can edit, copy, save, or share. Groq switches to its vision model automatically; saved providers can use a separate image model from Settings. Images are sent only during generation and are not saved in your library.",
  },
  {
    id: "dedicated-auth",
    version: "v0.6.9",
    date: "October 2, 2026",
    title: "Sign in now has its own page",
    summary:
      "A calmer, responsive authentication experience replaces the shaky mobile modal.",
    body: "PromptDock sign in, account creation, verification, password recovery, and password reset now live on a dedicated responsive page at /auth.",
  },
  {
    id: "brand-icons",
    version: "v0.6.8",
    date: "October 2, 2026",
    title: "Platform cards got a branded refresh",
    summary:
      "ChatGPT, Claude, Gemini, and GitHub references now use recognizable brand marks in PromptDock’s green visual system.",
    body: "The platform cards and sponsor areas now use local PNG brand assets with a PromptDock green treatment, so the tools you use are easier to recognize at a glance.",
  },
];
