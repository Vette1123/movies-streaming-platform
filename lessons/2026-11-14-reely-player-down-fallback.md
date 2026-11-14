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
