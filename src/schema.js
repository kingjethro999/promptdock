module.exports = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    username text,
    password_hash text NOT NULL,
    failed_logins integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS username text",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (lower(username))",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES users(id) ON DELETE SET NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users (referral_code) WHERE referral_code IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by) WHERE referred_by IS NOT NULL",
  "CREATE TABLE IF NOT EXISTS schema_migrations (key text PRIMARY KEY)",
  `WITH marker AS (INSERT INTO schema_migrations (key) VALUES ('grandfather_existing_accounts_v1')
    ON CONFLICT DO NOTHING RETURNING key)
    UPDATE users SET email_verified_at = created_at
    WHERE email_verified_at IS NULL AND EXISTS (SELECT 1 FROM marker)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    session_id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    user_agent text
  )`,
  "CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)",
  "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_id uuid NOT NULL DEFAULT gen_random_uuid()",
  "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()",
  "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text",
  "CREATE UNIQUE INDEX IF NOT EXISTS sessions_session_id_idx ON sessions (session_id)",
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('groq', 'gemini')),
    model text NOT NULL,
    encrypted_key text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  "ALTER TABLE user_ai_settings DROP CONSTRAINT IF EXISTS user_ai_settings_provider_check",
  "ALTER TABLE user_ai_settings ADD CONSTRAINT user_ai_settings_provider_check CHECK (provider IN ('groq', 'gemini', 'apmix'))",
  `CREATE TABLE IF NOT EXISTS user_ai_providers (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    provider text NOT NULL CHECK (provider IN ('groq', 'gemini', 'apmix', 'openai', 'anthropic')),
    base_url text NOT NULL DEFAULT '',
    model text NOT NULL,
    encrypted_key text NOT NULL,
    active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, provider_id)
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS user_ai_providers_active_idx ON user_ai_providers (user_id) WHERE active",
  "ALTER TABLE user_ai_providers ADD COLUMN IF NOT EXISTS base_url text NOT NULL DEFAULT ''",
  `INSERT INTO user_ai_providers (user_id, name, provider, base_url, model, encrypted_key, active)
    SELECT s.user_id,
      CASE s.provider WHEN 'groq' THEN 'Groq' WHEN 'gemini' THEN 'Gemini' ELSE 'APMIX' END,
      s.provider, '', s.model, s.encrypted_key, true
    FROM user_ai_settings s
    WHERE NOT EXISTS (SELECT 1 FROM user_ai_providers p WHERE p.user_id = s.user_id)`,
  `DELETE FROM user_ai_settings s
    WHERE EXISTS (SELECT 1 FROM user_ai_providers p WHERE p.user_id = s.user_id)`,
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
  "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS public_id uuid",
  "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS published_at timestamptz",
  "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS forked_from uuid",
  "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS owner_username text",
  "ALTER TABLE prompts ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'",
  "CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING gin (tags)",
  "CREATE UNIQUE INDEX IF NOT EXISTS prompts_public_id_idx ON prompts (public_id) WHERE public_id IS NOT NULL",
  "CREATE UNIQUE INDEX IF NOT EXISTS prompts_owner_fork_idx ON prompts (owner_key, forked_from) WHERE forked_from IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS prompts_owner_updated_idx ON prompts (owner_key, updated_at DESC)",
  `CREATE TABLE IF NOT EXISTS prompt_revisions (
    revision_id bigserial PRIMARY KEY,
    owner_key char(64) NOT NULL,
    prompt_id uuid NOT NULL,
    name text NOT NULL,
    data jsonb NOT NULL,
    idea text NOT NULL,
    analysis jsonb,
    tags text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (owner_key, prompt_id) REFERENCES prompts(owner_key, id) ON DELETE CASCADE
  )`,
  "CREATE INDEX IF NOT EXISTS prompt_revisions_prompt_idx ON prompt_revisions (owner_key, prompt_id, revision_id DESC)",
  `CREATE TABLE IF NOT EXISTS feedback_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('bug', 'idea', 'other')),
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 10000),
    contact_email text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS feedback_reports_created_idx ON feedback_reports (created_at DESC)",
  `CREATE TABLE IF NOT EXISTS user_update_reads (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    update_id text NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, update_id)
  )`,
  "CREATE INDEX IF NOT EXISTS user_update_reads_user_idx ON user_update_reads (user_id, read_at DESC)",
  `CREATE TABLE IF NOT EXISTS site_updates (
    id text PRIMARY KEY,
    version text NOT NULL,
    date_label text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS site_updates_published_idx ON site_updates (published_at DESC)",
  `CREATE TABLE IF NOT EXISTS api_rate_limits (
    bucket_key char(64) PRIMARY KEY,
    tokens double precision NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];
