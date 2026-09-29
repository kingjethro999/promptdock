# PromptDock

Turn a rough idea or spoken note into an editable prompt for ChatGPT, Claude, Gemini, and other AI tools. The app includes templates, account-based library sync, copy, and Markdown export.

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

Open <http://localhost:3000>. Set `DATABASE_URL` in `.env` to use your managed PostgreSQL database locally. Without a database, saved prompts stay in this browser only.

When a database is connected, create an account or sign in to save prompts and sync the library across devices. Passwords are hashed with scrypt; sessions use HTTP-only cookies. The first sign-in in a browser imports prompts saved by older PromptDock versions, then removes the old browser workspace token. Existing prompts on another device are available after signing in with the same account. Email verification and password reset are not available yet.

To dictate an idea, choose **Record idea**, speak, then **Stop & send**. The server transcribes with Groq and sends the resulting idea through prompt generation. **Cancel** or the two-minute limit discards the recording. Vercel's function payload limit caps recordings at 4 MB.

## Deploy

1. Use your existing Render Postgres database. No database service is deployed from this repository.
2. Copy its **External URL** from Render Dashboard → database → **Connect** → **External**. Keep the URL private.
3. Import this repository into Vercel with the repository root as its project root. Add `DATABASE_URL` with that **external URL**. The server adds `sslmode=require` automatically for Render external hosts when it is absent. Add `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` for AI and voice, or configure another supported provider using `.env.example`. Deploy. The app creates the account, session, and prompt tables on first database access.
4. Open the Vercel site. The sidebar version comes from the same frontend build as the deployed code. Check `/api/health` on that domain for database readiness.

The provider keys and database URL are never written to Git or the static frontend. The root `.env` is ignored by Git. Voice uses a browser with `MediaRecorder` on localhost or HTTPS.

Render Free Postgres has a 1 GB limit and expires after 30 days; plan an upgrade or export before expiry if you need to keep the data.

## Versioning

The project began at `v0.0.1`. The pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then increments the middle number through `v0.599.0 → v1.0.0`. From `v1.0.0` onward it increments the patch number. `package.json` uses numeric SemVer; `VERSION` and the frontend build use the `v` prefix. Run `npm run setup:hooks` after cloning.
