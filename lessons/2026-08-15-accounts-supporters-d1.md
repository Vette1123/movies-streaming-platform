# Accounts, supporters and D1 on a free-plan static export

## What

Ported the accounts / subscription / legal stack from the sibling
`social-media-downloader` project into Reely, adapted to a `output: 'export'`
site whose only server is one hand-written Worker on the Cloudflare free plan.

- Google-only sign-in: hand-rolled OAuth 2.0 + PKCE in `cloudflare/worker.js`,
  SHA-256-hashed session rows in D1, a 15-minute HMAC access token that never
  leaves memory, and a `reely_account=1` hint cookie + `reely_profile`
  localStorage cache so the header paints the signed-in state with zero requests.
- Buy Me a Coffee webhooks (`lib/billing/bmc.ts`), signature verified **before**
  `JSON.parse`, entitlements stored as a comma-separated grant SET.
- Supporter features: cloud sync (last-write-wins + tombstones), lists with
  notes/ratings and publishable `/l/<slug>` pages, new-episode web push
  (payload-less VAPID), year-in-Reely stats, supporter accent + density.
- `/account`: a hash-routed tabbed console (library, lists, alerts, appearance,
  playback, data), plus `/support`, `/privacy`, `/terms`.
- Legal + support pages, footer nav, header account control, mobile drawer
  account section.
- `migrations/0001_accounts.sql`, `vitest` (80 tests) for the pure modules,
  end-to-end verification against `wrangler dev` + local D1.

Nothing that was free became paid, and no existing hot path changed: page views
are static assets, and `/api/*` for search/filter/scroll never touches D1.

## Mistakes

- **Unpublishing a list nulled its slug.** `setPublished(false)` cleared
  `lists.slug`, so republishing minted a new one and every link already shared
  404'd. The slug was carrying two meanings — identity and visibility. Fixed by
  adding a `published INTEGER NOT NULL DEFAULT 0` column and keeping the slug
  forever; `loadPublicList` now filters on `published = 1`. Caught only because a
  test toggled publish twice and asserted `slug1 === slug2`.
- **Cancelling a membership deleted the supporters row.** BMC re-delivers
  events, and a stale `subscription.started` arriving after a cancellation found
  no row, so it happily inserted one and resurrected a cancelled membership.
  Reproduced locally by replaying the two webhooks out of order. The row is now a
  tombstone (`grants = ''`), and the revoke branch returns early when there is no
  row to revoke. Deleting a row loses the fact that something _used_ to be true —
  that fact is exactly what makes a replay safe to ignore.
- **`.sort()` on numbers.** `computeStats` sorted runtimes lexicographically, so
  the median of `[9, 10, 100]` came out as `10` by luck and wrong by design on
  real data. Found while extracting the function out of the panel into
  `lib/stats.ts`; it had been invisible inside JSX.
- **Two "failing" tests were the tests being wrong.** `safeRedirect('/////evil.example')`
  returns `/` (the browser parses that as an authority, so rejecting it is
  correct), and `normaliseItems` drops `id: 0` deliberately. I nearly "fixed" both
  guards to make my assertions pass. Read what the guard is for before believing
  a red test.
- **A pre-existing render hole surfaced on the way past.** The watch-history card
  printed a bare `S, E` for series saved without season/episode. Guarded on both
  fields.
- **The Cloudflare token cannot create D1.** It verifies 200 and does the WAF/DNS
  work, but every `/d1/database` call returns `401 code 10000` — it lacks the D1
  permission. Half an hour went into retrying different endpoints before checking
  the token's own scopes. Verify the permission, not the token.
- **`Date.now()` during render.** `PlanSection` compared the paid-through date to
  the browser clock to decide whether to show "active". The server already made
  that decision (`pro` is false once the period ends), so the only thing the
  extra check could add was a way for the two to disagree. Deleted.
- **CDP `Network.setCookie` did not stick** in the harness; setting cookies with
  `document.cookie` from the page did. And only `new_tab` hydrates React — a
  `goto_url` left dead click handlers that looked exactly like an app bug.

## What worked

- **Nothing new on a hot path.** Every account feature is either a static asset
  or a `/api/*` route that only signed-in visitors ever call. A visitor who never
  signs in causes zero extra Worker invocations, which is what keeps the free-plan
  budget intact.
- **The hint cookie + profile cache.** The header knows who you are before any
  request completes, and the supporter accent is applied by a tiny blocking
  inline script (`APPEARANCE_BOOT_SCRIPT`) reading the same cache — so there is no
  flash of the default palette on any navigation.
- **One fetcher.** `useAccountSession` (mounted once, in the header) refreshes;
  `useAccount` / `useAccountIdentity` are read-only. Adding a fifth place that
  shows the visitor's name costs nothing.
- **vitest on the pure modules only.** Entitlements, webhook verification, token
  signing, sync merge, list routes — 80 tests, 0.5s, no DOM, no runtime. The
  parts that needed a real runtime were verified against `wrangler dev` with a
  local D1 instead of mocked.
- **Wiping localStorage and restoring from D1** as the sync acceptance test. It
  is the only check that proves both directions at once.

## Rules

- A slug is an identity, not a visibility flag. Never null it to hide something —
  add the flag.
- Webhook revocations tombstone, never delete. A deleted row cannot tell a
  replayed event that it is stale.
- Numeric `.sort()` always takes a comparator. Extracting logic out of JSX into a
  testable module is how these get found.
- When a new test fails, first decide whether the assertion or the code is wrong.
  Security guards are the most likely to be right and the most costly to "fix".
- No clock reads during render. If the server already decided, render its
  decision.
- Before blaming a Cloudflare API, check the token's permission list.
- Browser harness: only `new_tab` hydrates, and cookies go in via
  `document.cookie`.
