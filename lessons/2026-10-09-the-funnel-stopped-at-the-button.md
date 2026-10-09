# The funnel stopped at the button

## What

Five changes to the supporter funnel, from one read of the PostHog numbers:

1. **The stall screen stopped making a false promise.** It said supporters get
   backup servers, but any free account already does. It now offers the Reely
   Player free on one title a day (`lib/player-trial.ts`). If that title stalls
   again, it points to /support.
2. **The support nudge fires on the 3rd play**, not only the 3rd watchlist
   save. Only 13 people had ever saved anything. The nudge is armed on the play
   and shown on the next page with no player open (`components/support/support-nudge-host.tsx`).
3. **The purchase path says which email to pay with**, under every Support
   button (`components/support/checkout-link.tsx`). It also watches for the
   payment after checkout (`checkout-watcher.tsx`). After 5 minutes it gives up
   honestly and offers a prefilled support email.
4. **The funnel is tracked past /support**: `checkout_started`,
   `supporter_gate_shown`, `signed_in`, `supporter_activated`,
   `player_trial_started`, `invite_shared`. A third bot fleet is filtered out
   (`isShanghaiDesktopFleet` in `lib/posthog-client.ts`): Shanghai timezone,
   zh-CN, desktop Chrome at 1920x1080 or 1440x900. That's 1,384 people and 0
   plays.
5. **Free accounts get an invite link.** Every 3 sign-ups from it earn a month,
   with a lifetime cap of 6 months (migration `0011_invite_codes.sql`).

## Mistakes

- **"Open referrals to free users" sounded like a UI flag. It wasn't.**
  Referrals were credited through the public profile page. Claiming a handle
  and serving the profile are both supporter-only, so a free user had no link
  at all. Un-hiding the panel would have shown a referral count that could
  never move. The fix needed its own identifier (an invite code that cannot
  collide with a handle) and a capture on any page.
- **Opening a money path to free accounts opened a farm.** Three throwaway
  Google accounts would have been a free month, forever. The 6-month cap went
  in before shipping. The better fix is in the `ponytail:` note: credit a
  referral only after the new account has done something.
- **Satisfying the lint rule introduced a bug.** `Date.now()` in render was
  moved to a clock stamped on mount. But a trial started afterwards carries a
  timestamp later than that clock. A negative age reads as "available", so the
  trial would never have turned on. Caught by re-reading the hook, not by a
  test. `startTrial` now advances the clock too.
- **Hand-rolled a copy/share pair while `useShare` existed.** It was in the
  2026-09-23 lesson, read too late. Replaced before commit.
- **The stall test rig fooled me twice.** A blackhole IP (`10.255.255.1`)
  fails slowly the first time, then instantly from cache. The iframe fires
  `load`, and the stall screen clears, which looks like the app hiding its own
  offer. A local server that accepts connections and never answers is a
  reliable stall.

## What worked

- Grouping PostHog sessions by browser, version, OS, screen, timezone and
  language, then counting plays per group. The fleet had zero plays in every
  group; the humans had plays everywhere.
- Stubbing `/api/pro/ticket` to stay pending was enough to render and check
  the on-trial UI with no Worker running.

## Not verified here

The signed-in flows: the gifts panel invite link, the checkout watcher, and
`signed_in` / `supporter_activated`. `next dev` has no Worker, so there is no
session. Check them on production after deploy.

## Rules

- Before opening a feature to a new audience, trace where the server checks
  entitlement. The UI gate is rarely the only one.
- Anything that grants months to a free account needs a ceiling on day one.
- Force an iframe stall with a hanging local server, never an unroutable IP.
