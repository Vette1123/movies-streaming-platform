# A trial spent on nothing

## What

`pnpm posthog:usage` flagged the Reely Player at 11 failures against 22 plays.
All 11 were boots that never played. The relay's `/selftest` on each title
split them: the supporter's four titles from 10-31 all play today (a passing
outage), 1411621 and 441178 have no stream at the provider (`no stream_urls`),
and 67175 was rate-limited at the time of the probe.

The two missing titles exposed a paywall bug. `holdsTrial` takes a free
visitor's one title of the day when the ticket is minted, before anybody knows
whether a stream exists, so a title the provider lacks spent the day's trial on
a black frame. Now:

- the player reports `dead_on_boot` with `hls_details: no_stream`
  (reely-pro-player `fatal()` reasons, shipped earlier the same day);
- `ReelyPlayer` passes `noStream` to `onUnavailable`, and `details-hero` calls
  `trial.refund()` before leaving the trial;
- `POST /api/pro/trial/release` runs `releaseTrial` (`lib/pro/ticket-access.ts`):
  the caller must hold this title's live trial (same subject as the mint), and
  `providerHasNoStream` must get a definite `stream: false` from the player
  worker's new `/api/stream/availability`, which asks the relay's signed
  `/resolve`. Anything else keeps the trial spent;
- that title offers no trial for the rest of the visit (`exposedTrialStatus`),
  so the stall screen cannot loop the same dead boot.

## Mistakes

- The first instinct was to ship the reason telemetry and wait a week for data.
  `/selftest` on the six failed titles answered it in a minute.
- The refund's first test used `'s'` as the ticket secret. `signEntryTicket`
  base64-decodes it, threw, and showed that a malformed secret would 500 the
  route. Signing moved inside the `try`, so it fails closed.
- The first live probe answered `stream: null`. A Cloudflare Worker never sees a
  5xx body from the relay, only Cloudflare's own `error code: 502` page, so the
  relay's `no stream_urls` 502 was unreadable. The relay now answers it as 404.
  On the way there, `error code: 502` on every no-stream probe looked like the
  Worker could not reach the relay at all. Resolving a title that streams
  through the same route (200 in 1.8s) disproved that in one request.
- Reely and the player are Workers on one account, and a plain fetch from one to
  the other's workers.dev URL is refused (error 1042). The call goes through the
  `PLAYER` service binding in `wrangler.jsonc`.
- The browser cannot be trusted to say "no stream": a refund anyone can trigger
  is unlimited free titles. The verdict is server-to-server, and only the
  relay's own `no stream_urls` counts.

## What worked

Reading the failed titles off `$pathname` and probing each one through the
relay, instead of reasoning from aggregate counts.

## Rules

- Anything a free tier spends must be refundable when the product failed to
  deliver, and the refund is decided server-side.
- An uncertain answer keeps the paywall closed: `null` is not `false`.
