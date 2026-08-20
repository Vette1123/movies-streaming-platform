-- Public profiles, smart lists, referrals and gift codes.
--
-- One migration for the whole supporter wave: every column here is read by
-- something that ships in the same deploy, and splitting them into five files
-- would only make five chances to apply four of them.
--
-- Applied with:
--   pnpm exec wrangler d1 migrations apply reely            (local)
--   pnpm exec wrangler d1 migrations apply reely --remote   (production)

-- The public half of an account.
--
--   handle          What /u/<handle> resolves to. Claimed once and then kept,
--                   because it is a URL somebody has already shared. UNIQUE, so
--                   two accounts can never answer the same address.
--   profile_public  Whether that page is served at all. Off by default: a
--                   handle is claimed to reserve a name, not to publish a
--                   library, and the two decisions are made at different times.
ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 0;
--   profile_bio     The line under the name. Its own column rather than a key
--                   inside prefs: /api/account rewrites that JSON wholesale
--                   from an allowlist, so a bio living there would be wiped
--                   the next time somebody changed their accent colour.
ALTER TABLE users ADD COLUMN profile_bio TEXT;

-- Who sent this person here, as the referrer's user id. Written once, at sign-up
-- only, from the handle in the /u/<handle> link they arrived through.
ALTER TABLE users ADD COLUMN referred_by TEXT;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- A list that stays true instead of staying still.
--
-- The saved-filter query string, in the same shape the browse URL uses, so the
-- list is "everything matching this" rather than "these titles" and the client
-- resolves it against the library it already has. NULL is an ordinary list —
-- which is what every existing row is, and why no backfill is needed.
ALTER TABLE lists ADD COLUMN smart_query TEXT;

-- A month of supporter, handed to somebody else.
--
-- The code is the primary key and is minted unguessably; `redeemed_by` being
-- NULL is what makes a code live, so redemption is a conditional UPDATE and two
-- people racing the same code cannot both win.
CREATE TABLE IF NOT EXISTS gift_codes (
  code        TEXT PRIMARY KEY,
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  months      INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  redeemed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gift_creator ON gift_codes(created_by);
