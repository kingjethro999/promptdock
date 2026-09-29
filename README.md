# PromptDock

Turn a rough idea or spoken note into an editable prompt for ChatGPT, Claude, Gemini, and other AI tools. The app includes a public interactive landing page, templates, voice input, account-based library sync, public prompt sharing, bring-your-own-key settings, copy, and Markdown export.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | Browser UI and server-side API code. |
| `api/index.js` | Small Vercel route entry point that forwards requests to `src/server.js`. |
| `src/schema.js` | Database table definition used by the API. |

The UI and API deploy together as **one Vercel project**. The browser calls `/api/*` on the same site; no separate backend URL or CORS setting is needed. API keys and `DATABASE_URL` belong in Vercel's server-side environment variables, never in the browser build.

## Run locally

Requires Node.js 20.12+. Copy `.env.example` to `.env` and set a provider key for AI features. The manual builder works without one.

```bash
npm ci
npm start
```

Open <http://localhost:3000>. Set `DATABASE_URL`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `BYOK_ENCRYPTION_KEY` in `.env` to use all account features locally. The ignored `.env` file is loaded by the server. The landing page is public; verified users open directly into the workspace.

Create an account, verify the link sent by email, and sign in to sync prompts across devices. The account flow includes password reset, password change, and signing out on all devices. Passwords are hashed with scrypt; sessions use HTTP-only cookies. Verification links expire after 24 hours and reset links after 1 hour. The first sign-in in a browser imports prompts saved by older PromptDock versions, then removes the old browser workspace token.

To share a prompt, save it to **My library**, then choose **Publish & share** on its card. Anyone with the `/p/<id>` link can view and copy the finished prompt without signing in. The public API exposes the prompt name and fields, but not the account email, original idea, or analysis notes. A guest who chooses **Save to my library** is taken through signup or sign-in; PromptDock creates an independent private copy. Repeating the action returns the same copy. **Make private** disables the old link while existing copies remain in their owners' libraries. Review prompt fields before publishing because the full finished prompt is public.

Prompt generation follows the source-backed design notes in [`docs/prompt-research.md`](docs/prompt-research.md). It preserves the user's requested action, separates instructions from idea input, gives concise examples to the model, and uses Gemini's system instruction field when Gemini is the provider.

In Settings, choose Groq or Gemini, enter a model ID and your own API key, and save. Keys are encrypted with AES-256-GCM before being stored in PostgreSQL. The API never returns the saved key. Set one stable `BYOK_ENCRYPTION_KEY` (64 hex characters) on every deployment; changing or losing it makes previously saved keys unreadable. A Groq key also powers voice transcription. Removing a personal key returns the app to its configured provider.

To dictate an idea, choose **Record idea**, speak, then **Stop & send**. The server transcribes with Groq and sends the resulting idea through prompt generation. **Cancel** or the two-minute limit discards the recording. Vercel's function payload limit caps recordings at 4 MB.

## Deploy

1. Import this repository into Vercel. Keep **Root Directory** as `./` and **Application Preset** as `Node`. The repository's `vercel.json` sets **Build Command** to `npm run build:frontend` and **Output Directory** to `src/dist`; set **Install Command** to `npm ci` if you override Vercel's default.
2. Add server-side environment variables in Vercel: `DATABASE_URL` (your Render database's **External URL**), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `BYOK_ENCRYPTION_KEY` (64 hex characters). Add `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` for PromptDock's default AI and voice, or configure another provider from `.env.example`. Keep all secret values out of Git and the browser build.
3. Deploy. The server uses verified TLS for Render external URLs and creates or migrates account, session, token, settings, and prompt tables on first database access. Open `/api/health` on the Vercel domain and expect `{"ok":true}`.
4. Once the permanent Vercel or custom domain is known, set `APP_URL` to that full HTTPS origin and redeploy. Verification and reset emails use that address. Without `APP_URL`, they use Vercel's production URL when available, then its deployment URL.

The provider keys, Gmail app password, encryption key, and database URL are never written to Git or the static frontend. The root `.env` is ignored by Git. Voice uses a browser with `MediaRecorder` on localhost or HTTPS.

Render Free Postgres has a 1 GB limit and expires after 30 days; plan an upgrade or export before expiry if you need to keep the data.

## Versioning

The project began at `v0.0.1`. The pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then `v0.1.0 → v0.1.1` and so on. Each `0.x.9` rolls to `0.(x+1).0`; `v0.599.0 → v1.0.0` is the requested major milestone. From `v1.0.0` onward, commits increment the patch number. `package.json` uses numeric SemVer; `VERSION` and the frontend build use the `v` prefix. Run `npm run setup:hooks` after cloning.
