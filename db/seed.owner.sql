-- The only seed that belongs in production.
--
-- `supporters` is keyed by email and is read on every sign-in
-- (claimSupporterGrants), so a row here grants the account its entitlement the
-- moment that address signs in with Google — no payment, no webhook, no waiting.
-- That is exactly what the owner needs to see the supporter half of the site on
-- the live database, and it is the same mechanism a real purchase uses, so it
-- tests the real path rather than a bypass.
--
--   pnpm d1:seed:owner        (local)
--   pnpm d1:seed:owner:remote (production)
--
-- lifetime = 1 means no cancellation event can ever revoke it — correct here,
-- since there is no subscription behind it to cancel.
--
-- source = 'owner' rather than 'bmc' so these rows are obvious in a query and
-- can be removed with:
--
--   DELETE FROM supporters WHERE source = 'owner';
--
-- Addresses are stored lowercased because the lookup lowercases what Google
-- reports. Add another address by adding a row, not by editing one.
INSERT OR REPLACE INTO supporters (email, grants, level, lifetime, source, event_id, updated_at)
VALUES
  ('boogado66@gmail.com', 'pro', 'Lifetime — everything I build', 1, 'owner', NULL, 0),
  ('boogado@yahoo.com', 'pro', 'Lifetime — everything I build', 1, 'owner', NULL, 0);
