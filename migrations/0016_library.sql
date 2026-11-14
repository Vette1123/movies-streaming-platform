-- Own-library mode: media Reely hosts itself, tier zero of the playback chain.
-- Everything else reaches outward — TMDB for the catalog, the provider for the
-- bytes, the relay for the walk — and each of those can be gated, rotated or
-- shut off by someone else. These tables are the counterpart: the catalog and
-- the bytes for media the site serves itself, so nothing about a title in here
-- depends on a third party staying friendly.
--
-- R2 needs a payment method on file; D1 does not, and this account already
-- runs one. So the bytes live in D1, split into 1 MiB chunks: the platform
-- caps a single BLOB row at 2 MB and a free-plan database at 500 MB, both of
-- which scripts/library-ingest.mjs measures and reports rather than trips over.
--
--   library_media   one row per playable unit: a movie, or one TV episode
--   library_files   one row per file in that unit's HLS tree
--   library_blobs   the bytes themselves, keyed by file + chunk index
--
-- A unit becomes playable only when its library_media row exists with status
-- 'ready' — written LAST by the ingest finalize, after every file row — so a
-- half-uploaded title is invisible to playback instead of half-playable.

CREATE TABLE IF NOT EXISTS library_media (
  media      TEXT PRIMARY KEY, -- 'movie:550' or 'tv:1399:2:7' (season 2, ep 7)
  title      TEXT,
  status     TEXT NOT NULL DEFAULT 'ready',
  duration_s INTEGER,
  added_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS library_files (
  key          TEXT PRIMARY KEY, -- '<prefix>/<relative path in the HLS tree>'
  media        TEXT NOT NULL,
  kind         TEXT NOT NULL,    -- 'playlist' | 'segment' | 'other'
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  chunks       INTEGER NOT NULL, -- how many library_blobs rows hold it
  added_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS library_files_media ON library_files(media);

CREATE TABLE IF NOT EXISTS library_blobs (
  key  TEXT NOT NULL,
  seq  INTEGER NOT NULL,         -- chunk index, 0-based, CHUNK_SIZE bytes each
  data BLOB NOT NULL,
  PRIMARY KEY (key, seq)
);
