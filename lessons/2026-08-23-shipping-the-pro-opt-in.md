# 2026-08-23 — Shipped: the supporters-only opt-in for the rich embed

## What

Shipped the Vidlink integration **gated exactly as ordered**: supporters can
opt in from Account → Playback ("Try the new player experience"); everyone
else — free visitors included — gets byte-for-byte today's behaviour.

- `NEXT_PUBLIC_STREAM_SOURCE_PRO` (+ `_QUERY`) defines the surface in
  `config/sources.ts` (`RICH_SOURCE`, label "Reely Beta"). Unset = the feature
  does not exist: no account toggle, no switcher entry, nothing.
- `visibleSourcesFor(richOptedIn)` is the single source of truth for what a
  visitor may choose from; the hook's per-title memory, account preference,
  device preference and `select()` all validate against it — so opting out
  makes any stored "Reely Beta" choice resolve like never chosen, with no
  cleanup migration.
- The flag rides `prefs.richPlayer` (server whitelist extended in
  `normalisePrefs`), honoured only while entitled: lapsed supporters fall back
  silently. Secrets were set via `gh secret set`; CI deploy green in 4m14s;
  `cf:health` all 6 checks passed.

## Mistakes

- **Verified prod with curl and met our own WAF** — a managed challenge page,
  not a broken deploy. The site challenges non-browser clients by design
  (`cf-waf-setup.mjs`); production health must go through `pnpm cf:health`,
  which speaks to Cloudflare properly, not through hand-rolled fetches that
  the front door is built to stop.
- **Forgot the server-side prefs whitelist on the first pass** — added
  `richPlayer` to the client type before remembering `normalisePrefs`
  strips unknown keys, which would have made the toggle save successfully
  locally (cache) and silently vanish on sync. The whitelist IS the API
  contract; new prefs go there first.
- GitHub's API TLS timed out twice during `gh run watch`/secret listing —
  retry after a pause beat any config change.

## What worked

- Reading `normalisePrefs` before writing the pref, the second time.
- Making opt-out require no data migration: validation-against-current-list
  means stale ids are inert by construction.
- Keeping the default journey provably untouched: anon page HTML contains no
  trace of the provider, tests pin `DEFAULT_SOURCE_ID` while the rich slot is
  configured.

## Rules

- Every new account preference touches THREE places or it is broken:
  `AccountPrefs`, the worker-side `normalisePrefs` whitelist, and the UI that
  writes it. The whitelist is load-bearing.
- Visitor-scoped lists (opt-ins, entitlements) must be validated at READ time
  everywhere an id is consumed — never stored-id-trusted.
- Production verification goes through `cf:health`; anything else meets the
  challenge page and lies to you about the deploy.
