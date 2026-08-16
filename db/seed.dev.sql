-- Local development fixture. NEVER run this with --remote.
--
-- Everything the account UI can show, without needing a Google client, a Buy Me
-- a Coffee webhook or a real browser session: a supporter account with a synced
-- library, two lists (one published), an alert and a tracked series. Enough to
-- open /account against `wrangler dev` and see every panel populated.
--
--   pnpm d1:seed
--
-- Idempotent: every row is INSERT OR REPLACE keyed the same way each run, so
-- re-seeding after a schema change costs nothing and duplicates nothing.
--
-- The session row is what makes it usable without signing in. `sessions.id` is
-- the SHA-256 of the cookie value, never the cookie itself (see lib/auth/session
-- .ts) — so the hash below is sha256('dev-session-token'), and the cookie to set
-- in the browser is the plain string:
--
--   document.cookie = 'reely_session=dev-session-token; path=/'
--   document.cookie = 'reely_account=1; path=/'

-- The account. Pro, so every supporter panel unlocks.
INSERT OR REPLACE INTO users
  (id, google_sub, email, name, picture, created_at, prefs, grants,
   sub_status, sub_variant, sub_renews_at, sub_ends_at, sub_past_due_since, sub_updated_at)
VALUES
  ('dev-user', 'dev-google-sub', 'dev@reely.local', 'Dev Supporter', NULL,
   1735689600000,
   '{"accent":"violet","density":"compact","alerts":true}',
   'pro',
   'active', 'monthly', 1767225600000, NULL, NULL, 1735689600000);

-- sha256('dev-session-token'), expiring in 2035 so it never goes stale mid-work.
INSERT OR REPLACE INTO sessions (id, user_id, created_at, expires_at)
VALUES
  ('7fef60999ea6a84de15934221684243e184aff47f2383ab23e0b4e5b88c534af',
   'dev-user', 1735689600000, 2051222400000);

-- The durable support record the account claims its grant from on sign-in.
INSERT OR REPLACE INTO supporters (email, grants, level, lifetime, source, event_id, updated_at)
VALUES ('dev@reely.local', 'pro', 'Reely — Supporter', 0, 'bmc', 1, 1735689600000);

-- A synced library: two saved titles, one watched, one part-way through a series.
-- Payloads are the same shape the client mirrors up (lib/library-sync.ts).
INSERT OR REPLACE INTO sync_items (user_id, store, item_key, payload, updated_at) VALUES
  ('dev-user', 'watchlist', '1061474',
   '{"id":1061474,"title":"Superman","media_type":"movie","poster_path":"/ombsmhYUqR4qqOLOxAyr5H8hdPV.jpg","addedAt":1735689600000}',
   1735689600000),
  ('dev-user', 'watchlist', '94605',
   '{"id":94605,"title":"Arcane","media_type":"tv","poster_path":"/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg","addedAt":1735689600000}',
   1735689600000),
  ('dev-user', 'watched', '155',
   '{"id":155,"title":"The Dark Knight","media_type":"movie","watchedAt":1735689600000,"runtime":152}',
   1735689600000),
  ('dev-user', 'episodes', '94605:1:3',
   '{"seriesId":94605,"season":1,"episode":3,"watchedAt":1735689600000}',
   1735689600000);

-- Two lists. The published one exercises /l/<slug> and the Worker's injection of
-- title/OG/JSON-LD into the exported shell; the private one exercises the toggle.
INSERT OR REPLACE INTO lists
  (id, user_id, name, description, slug, published, items, created_at, updated_at)
VALUES
  ('dev-list-public', 'dev-user', 'Rewatch forever',
   'The ones that hold up.', 'rewatch-forever', 1,
   '[{"id":155,"media_type":"movie","note":"Still the best score.","rating":10},{"id":94605,"media_type":"tv","note":null,"rating":9}]',
   1735689600000, 1735689600000),
  ('dev-list-private', 'dev-user', 'Watch with Dad', NULL, 'watch-with-dad', 0,
   '[{"id":1061474,"media_type":"movie","note":null,"rating":null}]',
   1735689600000, 1735689600000);

-- One delivered alert, so the account page has something in its history.
INSERT OR REPLACE INTO notifications (id, user_id, title, body, url, created_at, read_at)
VALUES
  ('dev-note-1', 'dev-user', 'Arcane', 'Season 2 Episode 1 is out.',
   '/tv-shows/94605', 1735689600000, NULL);

-- The series the hourly sweep watches on this account's behalf.
INSERT OR REPLACE INTO watched_media (media_key, name, next_air_date, next_label, checked_at, notified_key)
VALUES ('tv:94605', 'Arcane', '2026-11-09', 'S2E1', 1735689600000, NULL);
