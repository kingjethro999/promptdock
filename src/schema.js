module.exports = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    failed_logins integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)',
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
  'CREATE INDEX IF NOT EXISTS prompts_owner_updated_idx ON prompts (owner_key, updated_at DESC)'
];
