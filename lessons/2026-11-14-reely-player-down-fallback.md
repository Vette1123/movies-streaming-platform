# Reely Player down: skip it, say so, never charge for it

## What

Since 2026-11-13 the provider behind reely-resolver-relay refuses the relay's token
(`/api.php -> 403 "invalid api token"`), so every Reely Player play booted into a dead
frame before falling back. PostHog: 10 plays, 7 failures (41%) in the week before this fix.
The relay stays as it is. The site now copes with it being down:

- **One server-side signal.** `lib/pro/relay-health.ts` asks the relay's `/selftest` and
  judges it with the canary's own helpers (moved to `scripts/lib/relay-selftest.mjs`, so
  the canary and the site can never disagree). The Worker caches the answer per colo for
  5 minutes and serves it at `GET /api/stream/health`.
- **The ticket route refuses while it is down** (503 `relay-down`), before `ticketDenial`,
  so a free visitor's daily title is never spent on a dead frame.
- **The client skips it.** `resolveSourceId({ reelyUp })` ignores Reely at every step
  (per-title memory, Settings, device default, supporter default). `playableSources`
  drops it from the auto-hop list. Trial offers hide. Play goes straight to the next
  embed, with no error screen.
- **Said, not hidden.** The switcher keeps the Reely row, `aria-disabled`, with
  "Temporarily unavailable. Playing from a server below". `/support` and the supporter
  "What you have" list show an amber note on the Reely Player. The benefits copy is
  unchanged.
- **One `relay-down` issue.** The workflow already looked for an open issue before
  creating one (#193 is the only one open). A test now pins that order.
- **Charged since the outage:** 0 Pro grants in D1 since 2026-11-13 (last one
  2026-11-03).

## Mistakes

- Took `config/offers.ts` from the brief to be the Pro benefits. It is the sponsor-card
  catalogue. Benefits live in `config/support-features.ts`, rendered by `/support` and
  `components/support/plan-view.tsx`. Grep the copy, not the file name.
- Was asked to reverse engineer the provider's token gate "so it never breaks again".
  Declined: getting around a third party's deliberate lockout is not ours to do. It also
  could not deliver "never": the gate has changed six times since September. What can be
  made permanent is the site's behaviour when the relay is down.
- First draft of the house row was a chained ternary (disabled / upsell / select). Pulled
  it out into `houseRowAction`, which returns the props.
- The browser check on `127.0.0.1` never hydrated. Next 16 dev blocks cross-origin dev
  assets (`allowedDevOrigins`), so the page was static HTML and the client note never
  ran. Use `localhost`.

## What worked

- Proving the outage with the relay's own `/selftest` before writing anything (308ms,
  `invalid api token`).
- Red/green check by restoring HEAD's `config/sources.ts` and `worker.js` under the new
  tests: 5 of 12 failed, all 12 passed with the fix.
- Faking a signed-in supporter through the header's own cache (`reely_account` hint
  cookie + `reely_profile` in localStorage) to see the supporter switcher under
  `pnpm dev`, with a throwaway `app/api/stream/health` route standing in for the Worker.

## Rules

- A dependency the site can test gets one server answer, cached, and read in two places:
  the UI choice, and the endpoint that spends something (a ticket, a trial).
- Fail open on the client and closed on the server. One flaky fetch must not hide the
  player from every supporter; the server's refusal is what protects the trial.
- A rate-limit cooldown is not an outage. Do not take a feature away for 90 seconds.
- Mark an unavailable paid feature in place. Do not hide it, and do not rewrite it.

## 2026-11-15: the exception the design needed the next day

Tier 0 (the own-library media plane) broke the "relay down = player down"
equivalence. A library title carries **no relay hop at all**, so it plays while
the relay is shut out - and the health answer that skipped the player for every
title was hiding the one thing that worked. The rule is now per title:

- `GET /api/stream/health?ty=movie&id=550` composes the two facts the site can
  test (`composeReelyHealth`): the relay's walk AND library membership, read
  from the same catalog file the player reads (`lib/pro/library-catalog.ts`,
  one fetch per colo per 5 min). The bare question stays the relay's answer.
- The ticket gate (`handleProTicket`) spends a trial on a library title with
  the relay down; the 503 `relay-down` remains for provider-bound titles.
- The client asks per title (`useReelyUp(mediaKey)`; `movie:550` /
  `series:1399` mapped to the player's `movie`/`tv` vocabulary by
  `healthUrlFor`).

Also this day: the player's `TICKET_SECRET` was hand-set once and had drifted
from the site's `PLAYBACK_TICKET_SECRET` - every `/api/*` route answered
`{"error":"unauthorized"}` with a 200-shaped auth failure that looked exactly
like a broken player. Fixed by provisioning the secret through the player's CI
(`printf '%s' | wrangler secret put`), sourced from the site repo's value.
Rule: the two workers hold ONE secret, and CI is the only way it moves.
