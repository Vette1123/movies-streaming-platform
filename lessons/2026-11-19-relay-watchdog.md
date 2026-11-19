# Relay watchdog: a mail when a relay home disappears

## What

The site Worker gets a five-minute cron (`lib/relay-watch.ts`) that asks both
relay homes for `/health` (no provider, no vault, no egress), keeps one row in
D1 (`ops_health`, migration 0017) and mails the owner only when the chain's
state changes, or as a slow reminder while it stays broken. A weekly GitHub
canary (`relay-fallback.yml`, `pnpm relay:fallback`) walks relay-b alone,
because the hourly canary stops at relay 1 and never proves the fallback.

## Mistakes

- **The draft had primary and fallback backwards.** It was written as if the
  Oracle VM were the primary. `RELAY_URL` is relay 1 on Netlify (the player
  asks it first) and relay-b is the VM, so a dead VM would have mailed "redeploy
  Netlify" and a dead Netlify "check the VM". The test pinned the wrong remedy,
  so it was green. The mail now names each home's host, and two tests pin each
  remedy to the right state.
- **The mail could never have arrived.** The binding was pinned to
  `support@reely.space`, but Email Routing delivers a Worker's mail only to a
  _verified destination address_, and support@ is a routing alias. The one
  verified destination is the owner's personal inbox, and this repo is public,
  so it lives in the `ALERT_EMAIL_TO` Worker secret, uploaded by the existing
  secrets step. Without the secret the tick neither mails nor writes, so the
  first tick after it lands still sends the "armed" proof mail.
- Two nested ternaries (the house rule forbids them) became a helper and a
  lookup.

## What worked

- Checking the claims against the live system before trusting a green test:
  `/health` on both fronts (`ok`), the Email Routing API (verified
  destinations vs rules), and `pnpm relay:fallback` live (3/3 on relay-b).
- Bundling just `cloudflare/worker.js` with esbuild (same options as
  `build-worker.mjs`) proves the new import in under a second, without the
  full static export.

## Rules

- A Worker's `send_email` only reaches verified destinations; an Email Routing
  alias is not one.
- Name relay homes by host and provider in anything a human acts on;
  "primary" and "fallback" flipped once already.
