-- Match Night + Watch Together: two ephemeral, room-keyed features. Nothing
-- here is account data - rooms are anonymous by design (no sign-in gate on a
-- party feature) and short-lived (swept on room creation).
--
-- match_swipes is the whole state machine: a match is simply two rows for the
-- same (room_id, media_id) with liked = 1 from two different swipers. No
-- matches table to keep consistent - the query derives it, so there is nothing
-- to reconcile.

CREATE TABLE IF NOT EXISTS match_rooms (
  code TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS match_swipes (
  room_code TEXT NOT NULL,
  swiper TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  liked INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (room_code, swiper, media_id)
);

CREATE INDEX IF NOT EXISTS idx_match_swipes_room
  ON match_swipes (room_code, liked, media_id);

CREATE TABLE IF NOT EXISTS together_beats (
  code TEXT PRIMARY KEY,
  position REAL NOT NULL,
  playing INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
