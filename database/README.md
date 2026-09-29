# Database setup

Production uses a Render Postgres instance as the only separate service. If one already exists, use it. The root `render.yaml` can create a Free instance if needed. Use its external PostgreSQL URL for Vercel functions.

After Render finishes provisioning, run from the repository root:

```bash
./database/print-connection.sh
```

The script calls `render pg get promptdock-postgres --include-sensitive-connection-info --output json` and prints the external URL. Pass your database's Render service name as an argument if it differs. The Render CLI must be installed and logged in. Copy the URL into Vercel's `DATABASE_URL` environment variable. Render Dashboard → **Connect** → **External** provides the same value. Free databases have no managed connection pool. Never commit the URL or paste it into frontend code.

For local development with Docker:

```bash
cp database/.env.example database/.env
# Set POSTGRES_PASSWORD in database/.env.
docker compose --env-file database/.env -f database/compose.yaml up -d --build
```

Then set `PGHOST=127.0.0.1`, `PGPORT=5434`, `PGDATABASE=promptdock`, `PGUSER=promptdock`, and matching `PGPASSWORD` in the root `.env`. The local Docker image applies `schema.sql` on first initialization. The Vercel API applies the same schema automatically to Render Postgres on first use.
