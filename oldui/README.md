# Preserved PromptDock UI

This directory contains the browser UI that ran on port 3000 before the Next.js migration. It is kept in the repository as a working reference. Do not delete it when changing the main site: its copy, layouts, interactions, and assets help us compare future UI changes with the original product.

The main site now uses the Next.js App Router in `src/app/`. Route files, focused React modules, reusable controls, `src/app/globals.css`, and `public/` make the current frontend easier for contributors to find, review, and maintain. Next.js also owns page metadata, social previews, sitemap, and robots output. The deployed entry point is Next.js, not this static host.

## Run the comparison UI

From the repository root:

```bash
npm ci
npm run legacy:dev
```

Open <http://localhost:3000>. In another terminal, run `npm run next:dev -- -p 3333` to compare the current site at <http://localhost:3333>. `npm run legacy:start` builds and serves this UI without the development watcher. The generated `oldui/dist/` directory is ignored by Git; the source files in this directory are the preserved copy.

Account, library, referral, AI, settings, and admin actions call the same backend implementation in `src/backend.js` that Next.js uses. `oldui/server.js` serves the old HTML, CSS, JavaScript, and assets, then delegates `/api/*` and the feed to that backend. The old UI is therefore a visual and interaction reference, while the product data and security rules have one implementation. A configured development database and provider keys are needed for those account and AI journeys.

`app.js`, the HTML pages, browser scripts, local brand images, and styles are the old frontend. The styles here are a preserved copy; the main site keeps its own shared base styles in `src/styles/shared/` plus Next-specific styles in `src/styles/next/`. `vercel-api.js` is retained only as a record of the previous hosting entry point and is not used by the Next.js deployment.
