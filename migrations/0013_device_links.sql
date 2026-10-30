-- Signing a TV in without typing on it: the TV shows `user_code`, a signed-in
-- supporter enters it at /link, and the TV's poll collects a session.
--
-- `device_hash` is the SHA-256 of the secret only the TV holds, for the same
-- reason `sessions.id` is a hash. No session is stored here: it is minted at the
-- moment the TV collects it, so a database read never yields a working login.
-- Rows live ten minutes and are swept by the next /api/device/start.
CREATE TABLE IF NOT EXISTS device_links (
  user_code   TEXT PRIMARY KEY,
  device_hash TEXT NOT NULL UNIQUE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_links_expires ON device_links(expires_at);
