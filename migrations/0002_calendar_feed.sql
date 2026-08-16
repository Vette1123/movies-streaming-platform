-- The private calendar feed.
--
-- One secret per account, so a calendar client — which has no cookies, no
-- session and no way to sign in — can still be told what is coming without the
-- URL being guessable. Null until somebody asks for their feed: an account that
-- never opens the section never gets a secret minted for it.
--
-- SQLite treats NULLs as distinct in a UNIQUE index, so every un-minted account
-- coexists here. Rotating is an UPDATE to a fresh value, which kills the old URL
-- the moment it is written — that is the whole point of the button.
--
-- Applied with:
--   pnpm exec wrangler d1 migrations apply reely            (local)
--   pnpm exec wrangler d1 migrations apply reely --remote   (production)
ALTER TABLE users ADD COLUMN calendar_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_calendar_token
  ON users(calendar_token);
