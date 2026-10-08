module.exports = [
  {
    id: "firebase-github-linking-resolution",
    version: "v0.10.5",
    date: "October 8, 2026",
    title: "GitHub OAuth linking & provider identity synchronization",
    summary:
      "Resolved GitHub account connection errors for email/password accounts and fixed provider UID identity tracking.",
    body: "Fixed an issue where GitHub OAuth connections on existing email/password accounts failed with a verified email check error due to Firebase ID token email flags. PromptDock now accepts emails supplied by GitHub OAuth, accurately records provider UIDs in Postgres auth identities, and enables seamless re-linking when accounts are already linked in Firebase Auth.",
  },
  {
    id: "auth-esm-loader-fix",
    version: "v0.10.3",
    date: "October 8, 2026",
    title: "Serverless auth stability & CommonJS module loader resolution",
    summary:
      "Eliminated HTTP 500 runtime crashes on email/password login, registration, and root routes caused by transitive ES Module imports.",
    body: "Resolved an unhandled serverless runtime failure where transitive dependencies in firebase-admin (jwks-rsa and jose) threw ERR_REQUIRE_ESM on serverless environments during auth evaluation. Decoupled and lazy-loaded Firebase Admin modules so core routes, email/password sign-in, and registration evaluate without eager dependency overhead, while pinning jwks-rsa to a CommonJS-compatible release.",
  },
  {
    id: "firebase-auth-csp-resolution",
    version: "v0.10.2",
    date: "October 8, 2026",
    title: "Firebase Auth CSP & third-party provider sign-in hardening",
    summary:
      "Resolved Content Security Policy restrictions blocking Firebase Auth iframes and Google/GitHub third-party account creation.",
    body: "Fixed Content Security Policy directives in the Next.js edge proxy and API security headers to support Firebase authentication end-to-end. Added frame-src permissions for Firebase project auth domains (*.firebaseapp.com) and Google accounts, expanded connect-src to authorize Google Identity Toolkit and Secure Token endpoints, enabled user avatar loading from Google and GitHub profile hosts, and added client-side auth module pre-warming to protect transient user gestures against aggressive browser popup blockers.",
  },
  {
    id: "model-arena-playground",
    version: "v0.10.0",
    date: "October 8, 2026",
    title: "Side-by-side Model Arena & multi-provider comparison",
    summary:
      "Run and compare finished prompts across multiple AI models simultaneously in a side-by-side playground arena.",
    body: "Evaluate prompt consistency, quality, and instruction following across different AI architectures without leaving your workspace. PromptDock's new Model Arena lets you execute your prompt across configured providers in parallel with a single click. View real-time outputs side-by-side with word counts, status indicators, and individual response copy buttons to quickly choose the best output or refine your prompt for maximum reliability across LLMs.",
  },
  {
    id: "prompt-variables-interpolation",
    version: "v0.9.9",
    date: "October 8, 2026",
    title: "Interactive prompt variables & live interpolation",
    summary:
      "Detect template placeholders like {{variable}} and fill in custom test values before copying or testing.",
    body: "Turn your prompts into reusable dynamic templates. PromptDock now automatically detects {{variable}} placeholders in your prompt output and presents an interactive Prompt Variables panel. Enter custom values for each field to preview the fully interpolated result in real time. Your test values travel directly into the in-app Test Prompt runner, one-click clipboard copy, and Markdown export, with instant toggles between raw template code and substituted text.",
  },
  {
    id: "model-syntax-profiles",
    version: "v0.9.8",
    date: "October 8, 2026",
    title: "Model syntax profiles & .cursorrules export",
    summary:
      "Instantly adapt prompt syntax for Claude XML tags, OpenAI developer directives, reasoning models, or direct .cursorrules IDE rules.",
    body: "Prompts perform best when structured for the model executing them. PromptDock now features one-click target model optimization profiles in the prompt preview. Switch seamlessly between Universal Markdown, Claude (Anthropic XML tags like <role>, <task>, <context>, and <instructions>), OpenAI (structured developer headings and output schemas), Reasoning (o-series and DeepSeek-R1 step-by-step tradeoff analysis), and .cursorrules (ready-to-use IDE agent rulefiles). Switching profiles updates live previews, copies in the target syntax, and automatically formats downloads.",
  },
  {
    id: "interactive-research-drawer",
    version: "v0.9.7",
    date: "October 8, 2026",
    title: "Interactive research drawer & web grounding controls",
    summary:
      "Explore retrieved web sources directly in the prompt preview, ground ideas with explicit reference URLs, and control research modes.",
    body: "PromptDock now features an interactive Research Grounding Drawer inside the prompt preview. When live web research is used, you can explore the exact sources retrieved by Jina or Firecrawl, complete with page titles, source domain badges, publication dates, and excerpt snippets. Each source includes a direct link and one-click URL copy. You can now also paste explicit documentation or reference URLs directly in the fine-tune panel to ground prompt generation on exact APIs or specifications, and choose between Smart Detection (Auto), Always Research Web, or Offline knowledge modes.",
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
