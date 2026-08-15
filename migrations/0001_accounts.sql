-- Accounts, entitlement, and the synced library.
--
-- One migration rather than the eight this schema arrived as in the sibling
-- project: that history is a record of decisions made over months against a live
-- database, and replaying it here would only recreate columns that were renamed
-- later. What is kept is the shape those decisions landed on.
--
-- Applied with:
--   pnpm exec wrangler d1 migrations apply reely            (local)
--   pnpm exec wrangler d1 migrations apply reely --remote   (production)

-- The account. One row per Google identity.
--
-- Billing state is denormalised onto it rather than living in its own table:
-- there is exactly one subscription per user, so a join would be bought for
-- nothing. `grants` is the live entitlement channel — see the column note below.
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,   -- crypto.randomUUID()
  google_sub         TEXT NOT NULL UNIQUE,
  email              TEXT NOT NULL,
  -- Google's display name and avatar. Cosmetic: nothing about entitlement reads
  -- them, and a row without them renders a monogram.
  name               TEXT,
  picture            TEXT,
  created_at         INTEGER NOT NULL,
  -- JSON: accent, density, autoNext, preferred source, alerts. Never queried by
  -- content, so it needs no index and no columns of its own.
  prefs              TEXT,

  -- Capabilities, as a comma-separated SET. `pro` is the only name in use.
  --
  -- A set rather than a boolean because it is written by more than one path
  -- (the webhook, the sign-in claim, a hand-run UPDATE) and because a future
  -- second capability must not be able to clobber the first — see withGrant /
  -- withoutGrant in lib/billing/entitlement.ts, which read-modify-write it.
  --
  -- Never appears in a WHERE, so it needs no index.
  grants             TEXT,

  -- Subscription state. No live writer today: Buy Me a Coffee grants are a set,
  -- not a subscription. Kept because a one-off coffee is converted into one by
  -- hand ('canceled' plus a future sub_ends_at reads exactly as "paid through
  -- this date, then stops"), and because it is the half that must already work
  -- if a card processor is ever added.
  sub_status         TEXT,     -- active|trialing|past_due|scheduled_cancel|canceled|paused|unpaid|expired
  sub_variant        TEXT,     -- monthly|yearly|lifetime
  sub_renews_at      INTEGER,
  sub_ends_at        INTEGER,  -- entitlement survives to here on a cancellation
  sub_past_due_since INTEGER,  -- first past_due sighting; the grace window is measured from it
  sub_updated_at     INTEGER   -- replay guard
);

-- Billing matches on the address, and so does claimSupporterGrants on every
-- sign-in. Not UNIQUE: deleting and recreating a Google account can legitimately
-- leave two rows sharing an address, and a constraint failure there would break
-- sign-in rather than protect anything.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Which devices are signed in.
--
-- `id` is the SHA-256 of the cookie value, never the value: a leaked database
-- read must not hand anyone a working session. Revocation is a hard DELETE
-- rather than a revoked_at flag, which would put a `WHERE revoked_at IS NULL` on
-- every query in exchange for history nobody reads.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Who supports the project, keyed by the address they paid with.
--
-- Separate from `users` on purpose, and the separation is the whole point.
-- Support arrives at Buy Me a Coffee, which knows an email address and nothing
-- else; an account here is created by Google sign-in, which may happen days
-- later, never, or under a different address. Writing the grant straight onto
-- `users` matches zero rows in that window and reports success — the money lands
-- and the supporter gets nothing.
--
-- This row is the durable record. `users.grants` stays the only thing the app
-- reads, and is refreshed from here when the webhook lands (if the account
-- exists) and on every sign-in (claimSupporterGrants).
--
--   lifetime  1 = a cancellation may never revoke this. A one-time purchase has
--             nothing to cancel, but the provider still emits a cancellation
--             when the member removes the level from their account.
--   grants    An EMPTY string is a tombstone: support that was granted here and
--             then cancelled. The row survives the cancellation on purpose,
--             because `updated_at` and `event_id` are the only things that can
--             refuse a stale redelivery, and deleting the row throws both away.
--   event_id  The last event applied, so a redelivery is a no-op.
--   updated_at Epoch millis of the EVENT, not of the write, so an out-of-order
--             delivery cannot reinstate a cancelled membership.
--
-- Looked up by primary key only, so it needs no index.
CREATE TABLE IF NOT EXISTS supporters (
  email      TEXT PRIMARY KEY,
  grants     TEXT NOT NULL,
  level      TEXT,
  lifetime   INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'bmc',
  event_id   INTEGER,
  updated_at INTEGER NOT NULL
);

-- The synced library: watchlist, history, per-episode completion, resume points.
--
-- One row per ITEM rather than one blob per store, which is what makes two
-- devices editing different titles a non-event. Merge is last-write-wins per
-- item; a NULL payload is a tombstone, kept so a delete on one device survives a
-- pull on another instead of being resurrected by the other device's copy.
--
--   item_key  '550' for a title, '1399:2:5' for one episode.
--   updated_at The CLIENT's clock, clamped to server-now on write so a device
--             running fast cannot pin its version as permanently newest.
CREATE TABLE IF NOT EXISTS sync_items (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store      TEXT NOT NULL,
  item_key   TEXT NOT NULL,
  payload    TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, store, item_key)
);

-- The pull is always "everything for this user newer than <cursor>", so this is
-- the index that keeps a sync from scanning the user's whole library. D1 bills
-- rows scanned, not rows returned.
CREATE INDEX IF NOT EXISTS idx_sync_cursor ON sync_items(user_id, updated_at);

-- Named lists, with their notes and personal ratings.
--
-- `items` is a JSON array rather than a join table: a list is always read and
-- written whole (the editor drags rows around, the public page prints all of
-- them), so rows would buy ordering complexity and N writes per reorder for a
-- payload that is a few KB at the sizes anyone actually builds.
--
-- `slug` is minted on the first publish and then KEPT, published or not, and is
-- UNIQUE so a URL can never point at two lists. `published` is what the public
-- page reads: unpublishing 404s it immediately, and re-publishing restores the
-- same URL — which is the whole promise of a link somebody has already shared.
-- Nulling the slug instead would hand every re-publish a new URL and quietly
-- break the old one.
CREATE TABLE IF NOT EXISTS lists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  slug        TEXT UNIQUE,
  published   INTEGER NOT NULL DEFAULT 0,
  items       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id, updated_at);

-- Where to ping someone.
--
-- `id` is the SHA-256 of the endpoint URL, which makes re-subscribing the same
-- browser an upsert rather than a duplicate row. The push itself carries NO
-- payload — see lib/push/send.ts — so nothing sensitive is stored here beyond
-- the keys the protocol requires.
CREATE TABLE IF NOT EXISTS push_subs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  -- Set on a 404/410 from the push service. The second failure deletes the row:
  -- one failure is a transient outage, two is a browser that is never coming
  -- back, and an endpoint that 410s forever is a subrequest wasted every sweep.
  failed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subs(user_id);

-- What the hourly sweep already knows about a title, so it re-checks rather than
-- re-discovers. One row per title that at least one supporter has on a watchlist.
--
--   media_key     'series:1399' or 'movie:550' — the same key the watchlist
--                 stores, so the sweep's candidate query is a straight copy
--                 rather than a parse-and-rebuild.
--   notified_key  What we last pushed about ('3:4' for an episode, 'release'
--                 for a film), so a thing is announced once no matter how many
--                 times the sweep sees it.
CREATE TABLE IF NOT EXISTS watched_media (
  media_key     TEXT PRIMARY KEY,
  name          TEXT,
  next_air_date TEXT,
  next_label    TEXT,
  checked_at    INTEGER NOT NULL,
  notified_key  TEXT
);

-- The sweep picks the least recently checked rows, so this is the index the
-- whole cron path is built on.
CREATE INDEX IF NOT EXISTS idx_watched_checked ON watched_media(checked_at);

-- Queued notifications, drained by the service worker when a payloadless push
-- wakes it. Generating the text at display time rather than at send time means a
-- queued alert that is no longer true is simply never shown.
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
