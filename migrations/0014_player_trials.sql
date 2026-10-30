-- The free title on the Reely Player, enforced where the ticket is minted.
--
-- One row per subject: `user:<id>`, or `ip:<hash>` for someone signed out. The
-- hash is keyed with a Worker secret so this table cannot be read back into
-- addresses. A row lasts 24 hours and the hourly sweep deletes it.
CREATE TABLE IF NOT EXISTS player_trials (
  subject    TEXT PRIMARY KEY,
  media      TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_trials_expires ON player_trials(expires_at);
