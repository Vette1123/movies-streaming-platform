-- A personal invite link for every account, not only supporters with a public
-- page. Minted lazily the first time somebody opens their gifts panel, so
-- existing rows stay NULL until they want one. Unique because the auth callback
-- resolves a sign-up's referrer by it.
ALTER TABLE users ADD COLUMN invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
