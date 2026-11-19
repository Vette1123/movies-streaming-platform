-- Is each relay home still there?
--
-- One row, five columns, written only when the answer CHANGES (or when a
-- broken chain is due a repeat reminder). The five-minute watcher reads it to
-- know whether it already told somebody, so a healthy chain does no write at
-- all and a broken one cannot mail every tick.
--
-- `state` is the enum in lib/relay-watch.ts: healthy | primary-only |
-- fallback-only | down. `since` is when that state began, `notified_at` the
-- last mail about it - both epoch milliseconds, because every reader here
-- already speaks milliseconds.
CREATE TABLE IF NOT EXISTS ops_health (
  name TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  since INTEGER NOT NULL,
  notified_at INTEGER NOT NULL
);
