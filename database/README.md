# Database setup

Production uses the Render Postgres instance in the root `render.yaml`. This is the only separate service. It provides an external PostgreSQL connection URL that Vercel functions can use.

After Render finishes provisioning, run from the repository root:

```bash
./database/print-connection.sh
```

The script calls `render pg get promptdock-postgres --include-sensitive-connection-info --output json` and prints the external pooled URL. The Render CLI must be installed and logged in. Copy the URL into Vercel's `DATABASE_URL` environment variable. Render Dashboard → **Connect** → **External** → **Connection Pool** provides the same value. Managed databases do not provide a Docker container terminal; use the CLI or dashboard to retrieve credentials. Never commit the URL or paste it into frontend code.

For local development with Docker:

```bash
cp database/.env.example database/.env
# Set POSTGRES_PASSWORD in database/.env.
docker compose --env-file database/.env -f database/compose.yaml up -d --build
```

Then set `PGHOST=127.0.0.1`, `PGPORT=5434`, `PGDATABASE=promptdock`, `PGUSER=promptdock`, and matching `PGPASSWORD` in the root `.env`. The local Docker image applies `schema.sql` on first initialization. The Vercel API applies the same schema automatically to Render Postgres on first use.
