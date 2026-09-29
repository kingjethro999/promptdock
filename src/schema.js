module.exports = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    failed_logins integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz',
  'CREATE TABLE IF NOT EXISTS schema_migrations (key text PRIMARY KEY)',
  `WITH marker AS (INSERT INTO schema_migrations (key) VALUES ('grandfather_existing_accounts_v1')
    ON CONFLICT DO NOTHING RETURNING key)
    UPDATE users SET email_verified_at = created_at
    WHERE email_verified_at IS NULL AND EXISTS (SELECT 1 FROM marker)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)',
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose, created_at DESC)',
  `CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('groq', 'gemini')),
    model text NOT NULL,
    encrypted_key text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS prompts (
    owner_key char(64) NOT NULL,
    id uuid NOT NULL,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    data jsonb NOT NULL,
    idea text NOT NULL DEFAULT '',
    analysis jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_key, id)
  )`,
  'ALTER TABLE prompts ADD COLUMN IF NOT EXISTS public_id uuid',
  'ALTER TABLE prompts ADD COLUMN IF NOT EXISTS published_at timestamptz',
  'ALTER TABLE prompts ADD COLUMN IF NOT EXISTS forked_from uuid',
  'CREATE UNIQUE INDEX IF NOT EXISTS prompts_public_id_idx ON prompts (public_id) WHERE public_id IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS prompts_owner_fork_idx ON prompts (owner_key, forked_from) WHERE forked_from IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS prompts_owner_updated_idx ON prompts (owner_key, updated_at DESC)',
  `CREATE TABLE IF NOT EXISTS api_rate_limits (
    bucket_key char(64) PRIMARY KEY,
    tokens double precision NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`
];
