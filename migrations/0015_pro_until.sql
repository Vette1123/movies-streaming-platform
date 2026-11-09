-- An end date for the hand-set `pro` grant, so a prepaid year switches itself
-- off instead of depending on someone remembering to revoke it.
--
--   pnpm pro someone@example.com --until 2027-11-09
--
-- Epoch milliseconds, like every other timestamp here. NULL means forever,
-- which is what every grant made before this column existed already was.
--
--   supporters.ends_at  the durable record, keyed by address
--   users.pro_until     what entitlement reads (`isEntitled`), copied from the
--                       supporters row on sign-in (lib/billing/supporters.ts)
ALTER TABLE users ADD COLUMN pro_until INTEGER;
ALTER TABLE supporters ADD COLUMN ends_at INTEGER;
