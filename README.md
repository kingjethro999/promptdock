# PromptDock

Turn a rough idea or spoken note into an editable prompt for ChatGPT, Claude, Gemini, and other AI tools. The app includes a public interactive landing page, templates, voice input, account-based library sync, public prompt sharing, bring-your-own-key settings, copy, and Markdown export.

If PromptDock helps your work, [support the project on GitHub Sponsors](https://github.com/sponsors/kingjethro999).

## Project layout

| Path            | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `src/`          | Browser UI and server-side API code.                                      |
| `api/index.js`  | Small Vercel route entry point that forwards requests to `src/server.js`. |
| `src/schema.js` | Database table definition used by the API.                                |

The UI and API deploy together as **one Vercel project**. The browser calls `/api/*` on the same site; no separate backend URL or CORS setting is needed. API keys and `DATABASE_URL` belong in Vercel's server-side environment variables, never in the browser build.

## Run locally

Requires Node.js 20.19+ — that is the floor in `package.json` `engines`, and the lowest release ESLint accepts. The test suite adds one more constraint: the jsdom DOM tests need Node 22.22+ or 24.15+, and GitHub Actions runs Node 24. Copy `.env.example` to `.env` and set a provider key for AI features. The manual builder works without one.

```bash
npm ci
npm start
```

Open <http://localhost:3000>. Set `DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `BYOK_ENCRYPTION_KEY` in `.env` to use all account features locally. The ignored `.env` file is loaded by the server. The landing page is public; verified users open directly into the workspace.

Create an account, verify the link sent by email, and sign in to sync prompts across devices. Sign-up asks for a username — 3–24 letters, numbers, or underscores, unique across accounts — that travels with everything you share; Settings can change it later. Password fields carry a **Show**/**Hide** toggle so you can check what you typed. The account flow includes password reset, password change, and signing out on all devices. Passwords are hashed with scrypt; sessions use HTTP-only cookies. Verification links expire after 24 hours and reset links after 1 hour. Settings lists your active sessions with their device and sign-in time so you can end one you do not recognize, and **Delete account** erases your prompts, revisions, saved provider keys, and every session once you confirm your password. The first sign-in in a browser imports prompts saved by older PromptDock versions, including their tags and save dates, then removes the old browser workspace token.

Saved prompts can have up to eight tags. Library search runs on the server across names, ideas, tasks, and tags; results load in pages of 100 so older prompts remain searchable beyond the first screen. The library shows your tags as clickable filter chips with their counts; selecting a chip (or clearing it) filters server-side through `tag=`, and the sort control switches the order between recently updated and name A–Z (`sort=`), both for signed-in accounts and for prompts stored in the browser.
Every changed save keeps the previous version in a prompt's **History**. The 10 most recent earlier versions can be restored, and a restore keeps the current version in history too. **Compare** previews a version against your current prompt first, showing changed fields line by line with the lines a restore would remove or bring back, so nothing is restored blind. Deleting a prompt removes its revisions.
Use **Duplicate** on any library card to create a private, independent copy with its idea, notes, fields, and tags.
**Export JSON** downloads the entire library in one server request, including prompts beyond the first search page, and keeps each prompt's id, save time, tags, and fork origin. **Import JSON** adds private copies from a PromptDock backup; an id or fork origin that is still free in your library is reused, anything already there gets a fresh one, and save times are kept so your sort order survives a restore. Public links and account details are not exported or restored.
**Paste in**, beside **New prompt**, opens a form for a title, prompt text, and optional tags so a prompt written elsewhere can be stored and shared without rebuilding its fields. Pasted text stays verbatim when copied, run, or viewed through a public link; adding builder fields turns it into a structured prompt. Long dropdowns — the active provider, the builder's format and tone menus, and any list of six or more options — open with a search box that filters as you type. Drafts, ideas, and prompts accept very long text: the remaining ceilings are safety limits counted in hundreds of thousands of characters, not a few thousand.

To share a prompt, save it to **My library**, then choose **Publish & share** on its card. Anyone with the `/p/<id>` link can view and copy the finished prompt without signing in. Shared pages render prompt-specific Open Graph and Twitter metadata on the server, so link previews do not depend on JavaScript. When your account has a username, the shared page and its link preview are titled `KingJethro wants to share a prompt with you`, and the page itself says `KingJethro shared a prompt with you`; accounts without a username keep the prompt's name as the title. The public API exposes the prompt name and fields, but not the account email, original idea, or analysis notes. A guest who chooses **Save to my library** is taken through signup or sign-in; PromptDock creates an independent private copy. Repeating the action returns the same copy. **Make private** disables the old link while existing copies remain in their owners' libraries. Review prompt fields before publishing because the full finished prompt is public.

Prompt generation follows the source-backed design notes in [`docs/prompt-research.md`](docs/prompt-research.md). It preserves the user's requested action, separates instructions from idea input, gives concise examples to the model, and uses Gemini's system instruction field when Gemini is the provider.

**Run prompt** sends the assembled prompt to your configured provider and shows the reply in the preview column, so a draft can be tested without leaving PromptDock. The response can be copied or dismissed, and runs count against the same AI budget as generation: 20 per hour.

In Settings, save as many providers as you like — Groq, Gemini, APMIX, a custom OpenAI-compatible endpoint, or a custom Anthropic-compatible endpoint — give each one a name, and choose the active entry from the **Active provider** dropdown; **PromptDock default** switches back to the system AI without deleting anything. Custom endpoints need a base URL that is HTTPS (localhost may use HTTP), and PromptDock appends `/chat/completions` or `/v1/messages` for you, so paste a root such as `https://openrouter.ai/api/v1`. APMIX BYOK uses `https://api.apmix.ai/v1` unless `APMIX_BASE_URL` is configured on the server. Keys are encrypted with AES-256-GCM before being stored in PostgreSQL. The API never returns the saved key. Set one stable `BYOK_ENCRYPTION_KEY` (64 hex characters) on every deployment; changing or losing it makes previously saved keys unreadable. Accounts keep up to 10 saved providers, one active at a time, and each can be renamed, updated, or deleted. The same two custom types can also be configured once for the whole deployment with the `OPENAI_*` and `ANTHROPIC_*` variables in `.env.example`. An active Groq key also powers voice transcription; otherwise the server's `GROQ_API_KEY` does.

Settings also carries a **This hour** usage meter for each AI action — Run prompt, Improve with AI, Idea to prompt, and Voice transcription. Every action draws from a rolling hourly budget shared by your account (or your IP when signed out), and `GET /api/usage` reports how many uses are left and when the budget refills, so the meter shows the cost of a busy hour before you hit a 429.

To dictate an idea, choose **Record idea**, speak, then **Stop & send**. The server transcribes with Groq and sends the resulting idea through prompt generation. **Cancel** or the two-minute limit discards the recording. Vercel's function payload limit caps recordings at 4 MB.

Run `npm test` for route, account, provider, voice, sharing, database validation, version, and browser DOM checks. The DOM tests load the real workspace page with jsdom and drive library search, tag chips, backup import, the paste-in form, searchable dropdowns, password show/hide toggles, and the username signup field, so no browser or server is required. The account flow test uses an in-memory query adapter, so it does not send email or require a live database.
Run `npm run lint` to check the browser and Node code with ESLint. GitHub Actions runs `npm ci`, lint, tests, and the frontend build on every push and pull request.

AI routes use a shared PostgreSQL token bucket to control provider spend across Vercel function instances: 20 idea generations, 20 test runs, 30 enhancements, and 10 voice transcriptions per hour, replenished gradually. Buckets are keyed per signed-in account, so a shared office or mobile IP never spends another user's allowance; guests and sign-in attempts fall back to the client IP. Sign-in, sign-up, and email routes are throttled too: 20 logins and 10 password resets per 15 minutes, 10 sign-ups per hour, and 6 verification or reset emails per hour. Exceeding a limit returns HTTP 429 with `Retry-After`. Local development without PostgreSQL uses a process-local bucket. Bucket rows and stale local entries are pruned automatically once they outlive the longest limit window.

The API and static deployment send a content security policy, frame protection, referrer policy, permissions policy, MIME sniffing protection, and HSTS for one year with subdomains. The policy allows PromptDock's own scripts and Google Fonts while keeping API requests on the same origin. `src/security.js` is the single source of truth: `npm run headers:sync` regenerates the matching `vercel.json` block and `npm run headers:check` (run in CI) fails if the two drift apart.

## Deploy

1. Import this repository into Vercel. Keep **Root Directory** as `./` and **Application Preset** as `Node`. The repository's `vercel.json` sets **Build Command** to `npm run build:frontend` and **Output Directory** to `src/dist`; set **Install Command** to `npm ci` if you override Vercel's default.
2. Add server-side environment variables in Vercel: `DATABASE_URL` (your Render database's **External URL**), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `BYOK_ENCRYPTION_KEY` (64 hex characters). Add `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` for PromptDock's default AI and voice, or configure another provider from `.env.example`. Keep all secret values out of Git and the browser build.
3. Deploy. The server uses verified TLS for Render external URLs and creates or migrates account, session, token, settings, and prompt tables on first database access. Open `/api/health` on the Vercel domain and expect `{"ok":true}`.
4. Once the permanent Vercel or custom domain is known, set `APP_URL` to that full HTTPS origin and redeploy. Verification and reset emails use that address. Without `APP_URL`, they use Vercel's production URL when available, then its deployment URL.

The provider keys, Gmail app password, encryption key, and database URL are never written to Git or the static frontend. The root `.env` is ignored by Git. Voice uses a browser with `MediaRecorder` on localhost or HTTPS.

Render Free Postgres has a 1 GB limit and expires after 30 days; plan an upgrade or export before expiry if you need to keep the data.

## Versioning

The project began at `v0.0.1`. The pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then `v0.1.0 → v0.1.1` and so on. Each `0.x.9` rolls to `0.(x+1).0` through `v0.598.9 → v0.599.0`; the final pre-1.0 sequence is `v0.599.0` through `v0.599.9 → v1.0.0`. From `v1.0.0` onward, commits increment the patch number. `package.json` uses numeric SemVer; `VERSION` and the frontend build use the `v` prefix. Run `npm run setup:hooks` after cloning. The hook runs `npm run lint` first, so a commit that fails lint is rejected before the version moves on; when `node_modules` is missing it warns and skips the lint step instead.

## License

PromptDock is licensed under the [MIT License](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, and pull request guidance.
