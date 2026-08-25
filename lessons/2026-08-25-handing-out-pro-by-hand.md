# Handing out pro by hand

## What

Granted `pro` to one address, and left behind `pnpm pro <email> [--revoke]`
(`scripts/grant-pro.mjs`) so the next one is a paste.

## Mistakes

`pnpm exec wrangler d1 execute reely --remote` died with a bare `fetch failed`
before anything was read. Rather than debug wrangler's transport, the script
talks to the D1 REST API directly — the same path `scripts/bmc-probe.mjs`
already uses against production, and the one that works from this machine.

No wrong turn beyond that: the shape of the write was already decided by
`lib/billing/bmc.ts`, and the script copies it rather than inventing one.

## What worked

Reading the webhook first. A hand grant is not "UPDATE users SET grants='pro'":

- The durable record lives in `supporters`, keyed by the paying address. That is
  what makes granting to an address with **no account yet** work — sign-in claims
  it (`claimSupporterGrants`). Writing only to `users` matches zero rows and
  reports success.
- `users.grants` is a comma-separated SET, so both writers read-modify-write it.
  An assignment detaches every other capability.
- `lifetime = 1` on a hand grant, because there is no subscription behind it to
  expire and the flag is what refuses a later cancellation event.
- Revoke tombstones the supporters row (`grants = ''`) instead of deleting it —
  `updated_at` is the only thing that can refuse a stale redelivery.

## Rules

- Any new writer of entitlement mirrors `lib/billing/bmc.ts`, both tables, same
  order. If it writes one table, it is wrong.
- Verify the grant by reading production D1 back, not by trusting the 200.
