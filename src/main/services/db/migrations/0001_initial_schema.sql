CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  global_default_model_ref_json TEXT,
  context_last_n INTEGER NOT NULL DEFAULT 20,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_configs (
  provider_id TEXT PRIMARY KEY,
  endpoint_url TEXT,
  credential_ref TEXT,
  models_json TEXT NOT NULL,
  last_saved_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  verbosity TEXT,
  temperature REAL,
  tags_json TEXT NOT NULL,
  model_ref_json TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
