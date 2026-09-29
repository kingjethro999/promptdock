CREATE TABLE IF NOT EXISTS prompts (
  owner_key char(64) NOT NULL,
  id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  data jsonb NOT NULL,
  idea text NOT NULL DEFAULT '',
  analysis jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_key, id)
);

CREATE INDEX IF NOT EXISTS prompts_owner_updated_idx ON prompts (owner_key, updated_at DESC);
