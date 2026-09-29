# PromptDock

Turn a rough idea or spoken note into an editable prompt for ChatGPT, Claude, Gemini, and other AI tools. The app includes templates, a searchable library, copy, and Markdown export.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | Browser UI and server-side API code. |
| `api/index.js` | Small Vercel route entry point that forwards requests to `src/server.js`. |
| `database/` | PostgreSQL schema, local Docker setup, and Render connection helper. |

The UI and API deploy together as **one Vercel project**. The browser calls `/api/*` on the same site; no separate backend URL or CORS setting is needed. API keys and `DATABASE_URL` belong in Vercel's server-side environment variables, never in the browser build.

## Run locally

Requires Node.js 20.12+. Copy `.env.example` to `.env` and set a provider key for AI features. The manual builder works without one.

```bash
npm ci
npm start
```

Open <http://localhost:3000>. Without `DATABASE_URL` or local `PG*` settings, saved prompts stay in browser storage. For local PostgreSQL, see [database/README.md](database/README.md).

When a database is connected, saved prompts sync through the same-origin API. Existing prompts from the same browser origin are imported on first load. Each browser has a random local workspace token. There is no account system yet, so clearing browser storage loses access to that browser's workspace.

To dictate an idea, choose **Record idea**, speak, then **Stop & send**. The server transcribes with Groq and sends the resulting idea through prompt generation. **Cancel** or the two-minute limit discards the recording. Vercel's function payload limit caps recordings at 4 MB.

## Deploy

1. Create a Render Blueprint using `render.yaml`. It creates **only Render Postgres**, with an external connection pool URL for Vercel. Render's private Docker service cannot provide a public PostgreSQL URL to Vercel, so the Docker image in `database/` is for local development.
2. After the database is ready, run `database/print-connection.sh` from a terminal with the Render CLI installed and logged in. It prints the external URL to copy. You can also find it under Render Dashboard → database → **Connect** → **External** → **Connection Pool**. Keep the URL private.
3. Import this repository into Vercel with the repository root as its project root. Add `DATABASE_URL` with that **external pooled URL**. Add `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` for AI and voice, or configure another supported provider using `.env.example`. Deploy. The app creates its `prompts` table and index on first database access.
4. Open the Vercel site. The sidebar version comes from the same frontend build as the deployed code. Check `/api/health` on that domain for database readiness.

The provider keys and database URL are never written to Git or the static frontend. The root `.env` and `database/.env` are ignored by Git. Voice uses a browser with `MediaRecorder` on localhost or HTTPS.

## Versioning

The project began at `v0.0.1`. The pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then increments the middle number through `v0.599.0 → v1.0.0`. From `v1.0.0` onward it increments the patch number. `package.json` uses numeric SemVer; `VERSION` and the frontend build use the `v` prefix. Run `npm run setup:hooks` after cloning.
