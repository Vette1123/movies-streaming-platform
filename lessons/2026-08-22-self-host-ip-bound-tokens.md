# 2026-08-22 — Self-host player disabled: provider tokens are IP-bound

## What
Made **Server 1** (`NEXT_PUBLIC_STREAMING_MOVIES_API_URL`, the first embed after
self-host) the default source for **everyone, including pro**, and dropped the
self-host **Reely Player** from the source list. All in `config/sources.ts`:
labels are now pinned to their env slot (`Server 1/2/3`) instead of derived from
list position, and `buildSources()` stable-sorts the default label to position 0
so free visitors — who only ever get `sources[0]` — start on a working embed.
Removing the `reely` entry makes `source.id === REELY_SOURCE_ID` false
everywhere, so `useReely` in every hero is always false and `ReelyPlayer` never
renders. No other file changed.

## Mistakes
- **Chased the relay first.** Spent the opening of the session verifying the
  `reely-resolver-relay` (Deno Deploy) health, worker secrets, and the HMAC
  chain — all of which were fine — before proving the actual wall. The relay
  *premise* was the bug, not its configuration.
- **First fix was to the wrong repo.** Stripped the relay tier out of
  `reely-pro-player/client/main.ts` and deployed it **locally** with wrangler,
  twice. Then learned the hard rule: **never deploy locally — CI auto-deploys on
  push.** Reverted source + redeployed to restore prod to git HEAD (net zero, no
  drift, but it should never have been a local deploy). The real fix lived in the
  *movies-streaming-platform* repo (the source list), not the player worker.
- **Guessed the default label twice.** Wrote `Server 2`, corrected to `Server 1`
  after the user clarified "the one after self host." The list order is
  `[Reely Player, Server 1, Server 2, Server 3]` — "Server 1" is the first embed,
  not `STREAM_SOURCES[0]`.

## What worked
- **Controlled IP-binding test.** Same playlist token, two fetchers: Deno egress
  (relay) got `200` and validated `#EXTM3U`; the visitor's browser AND a
  residential curl both got `403` on that exact URL, even with
  `Referer: https://vixsrc.to/`. Then loading the provider's own embed page
  *in-browser* resolved a fresh token and played (`readyState 4`, segments 200
  from the CDN). Conclusion: the provider binds each playlist token to the IP
  that fetched the embed — so resolve-on-server / play-in-browser can never work.
- Reading `use-stream-source.ts` end to end revealed free users only ever get
  `sources[0]`, which is why position 0 had to become the working embed.

## Rules
- **Provider playlist tokens are IP-bound.** Any "resolve on server X, play in
  browser Y" design is dead on arrival for this provider. Only same-IP
  resolve+play works — i.e. the provider's own embed page in the visitor's
  browser. See the private `reely-resolver-relay` repo; its whole premise is
  void.
- **Never deploy locally. Push to `main`; CI deploys.** Applies to every repo in
  this stack.
- Source labels are pinned to env slots in `config/sources.ts`; "Server N" is
  `NEXT_PUBLIC_STREAM_SOURCE_N` (Server 1 = `STREAMING_MOVIES_API_URL`),
  independent of list order.
- Leftover: the "Reely Player" promo copy still ships in
  `components/account/playback-panel.tsx`, `app/support/page.tsx`, and
  `config/support-features.ts`. Stale now that self-host is off — cosmetic, left
  for a follow-up.
