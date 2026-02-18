CREATE TABLE IF NOT EXISTS councils (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  goal TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('autopilot', 'manual')),
  tags_json TEXT NOT NULL,
  member_colors_json TEXT NOT NULL,
  conductor_model_ref_json TEXT,
  archived_at_utc TEXT,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS council_members (
  council_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (council_id, agent_id),
  FOREIGN KEY (council_id) REFERENCES councils(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT
);
