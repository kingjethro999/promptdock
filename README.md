# PromptDock

Turn a rough idea or spoken note into a structured, editable prompt for ChatGPT, Claude, Gemini, and other AI tools. The app includes templates, a searchable prompt library, copy, and Markdown export.

## Project layout

| Directory | Purpose |
| --- | --- |
| `frontend/` | Static browser app; `npm run build:frontend` writes `frontend/dist/` for Vercel. |
| `backend/` | Node API for AI, transcription, and saved prompts; Dockerfile for Render. |
| `database/` | PostgreSQL image, initialization schema, and local Compose setup. |

The browser sends AI requests to the backend. The backend alone holds provider keys and connects to PostgreSQL. A database private service has no public web link; share the **backend web service URL** after deployment to connect the frontend.

## Run locally

Requires Node.js 20.12+ and Docker for database sync. Copy `.env.example` to `.env` and add at least one AI provider key for AI features. The manual builder works without a key.

```bash
cp database/.env.example database/.env
# Set a long POSTGRES_PASSWORD in database/.env.
docker compose --env-file database/.env -f database/compose.yaml up -d --build
# Copy the same password into the optional PG* values in the root .env (PGPORT=5434).
npm ci
npm start
```

Open <http://localhost:3000>. `npm start` builds the frontend with the current `VERSION` and starts the API, which serves it locally. Without a database connection, saved prompts stay in browser storage. When database sync is configured, existing prompts from that same browser origin are imported on first load and new saves go through the API. Each browser has a random workspace token stored locally; this is not an account system, so clearing browser storage loses access to that workspace. Keep the token private.

Choose **Record idea**, allow microphone access, speak, then **Stop & send**. PromptDock transcribes with Groq, adds the text to the idea box, and automatically generates a structured prompt. **Cancel** and the two-minute limit discard the recording. Audio is not stored in the prompt library. Microphone access requires localhost or HTTPS.

## Deploy to Render and Vercel

1. In Render, create a Blueprint from this repository's `render.yaml`. It creates a private PostgreSQL Docker service with a persistent disk and a public backend Docker web service. A persistent disk requires a paid Render service. Set `GROQ_API_KEY` and any other provider keys on the backend. Set `FRONTEND_ORIGIN` to the exact Vercel site origin once known. The backend health check is `/api/health`.
2. In Vercel, import the same repository. Keep the repository root as the project root; `vercel.json` builds only the static frontend. Set build environment variable `PUBLIC_API_URL` to the public Render backend origin, such as `https://promptdock-api.onrender.com` (no trailing path). Redeploy after changing it.
3. Open the Vercel site and confirm its sidebar version, AI status, voice, and library. If the site and API cannot communicate, check that `FRONTEND_ORIGIN` exactly matches the site origin. For preview deployments, add those origins as a comma-separated list or use the production domain.

Render's database service is private and speaks PostgreSQL, so Vercel cannot connect directly to it. Do not put database credentials or AI keys in Vercel environment variables. Render's Docker PostgreSQL data requires the disk mounted at `/var/lib/postgresql/data`; the image uses `PGDATA=/var/lib/postgresql/data/pgdata`. The schema in `database/schema.sql` runs when the database volume is first initialized. If you later choose Render-managed PostgreSQL instead, point the backend at its `DATABASE_URL` and apply the same schema.

The platform buttons copy the prompt and open the selected AI platform in a new tab. AI requests send the idea or current draft to a configured provider. The server follows `AI_PROVIDER_ORDER` and `AI_MAX_FALLBACKS`, supporting APMIX, Groq, and Gemini. The root `.env` and `database/.env` are ignored by Git.

## Versioning

The project began at `v0.0.1`. The pre-commit hook bumps every later commit: `v0.0.9 → v0.1.0`, then increments the middle number through `v0.599.0 → v1.0.0`. From `v1.0.0` onward it increments the patch number. `package.json` uses numeric SemVer; `VERSION` and the frontend build use the `v` prefix. Run `npm run setup:hooks` after cloning.
