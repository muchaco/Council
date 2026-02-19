ALTER TABLE councils ADD COLUMN autopilot_max_turns INTEGER;
ALTER TABLE councils ADD COLUMN autopilot_turns_completed INTEGER NOT NULL DEFAULT 0;
