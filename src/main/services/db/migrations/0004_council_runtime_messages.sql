CREATE TABLE IF NOT EXISTS council_messages (
  id TEXT PRIMARY KEY,
  council_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('member', 'conductor')),
  sender_agent_id TEXT,
  sender_name TEXT NOT NULL,
  sender_color TEXT,
  content TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (council_id) REFERENCES councils(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  UNIQUE (council_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS council_runtime_briefings (
  council_id TEXT PRIMARY KEY,
  briefing_text TEXT NOT NULL,
  goal_reached INTEGER NOT NULL DEFAULT 0,
  updated_at_utc TEXT NOT NULL,
  FOREIGN KEY (council_id) REFERENCES councils(id) ON DELETE CASCADE
);
