# 2026-08-23 — The rich player works again, riding Vidlink's postMessage

## What

Shipped the working solution for "our rich player experience without owning
the bytes": **Vidlink as an embed source plus a postMessage progress bridge**.

- Vidlink (`vidlink.pro`) publishes what no vidsrc-family provider does:
  customization query params (`primaryColor`, `autoplay`, `nextbutton`…) AND
  parent-window events — `PLAYER_EVENT`
  (`play/pause/seeked/ended/timeupdate` with `currentTime`/`duration`) and
  `MEDIA_DATA` (full per-title/per-episode progress). Their player also
  auto-resumes from its own origin storage, so replaying a title continues
  where *their* player left off.
- `lib/embed-progress.ts` — pure envelope parser (`PLAYER_EVENT` shapes only)
  and a ≥5s write throttle (a seek's backwards jump counts as movement).
- `components/player/embed-progress-bridge.tsx` — mounted by DetailsHero next
  to the embed iframe while playing; trust is derived exactly like
  ReelyPlayer does it: message origin must equal the CURRENT frame URL's
  origin and come from that frame's own contentWindow. No host string exists
  anywhere in the repo — any future provider adopting the same contract just
  works.
- `config/sources.ts` slots grew an optional per-slot `query` env var
  (`NEXT_PUBLIC_STREAM_SOURCE_N_QUERY`), appended to playback URLs — how the
  slot carries Reely branding (rose palette, autoplay on, their next-button
  off so OUR up-next stays the single next-up surface) without naming hosts.
- Local `.env.local`: Server 1 = vidlink.pro (branded), 2 = vidsrc.to,
  3 = vidsrcme.ru. Prod flip = change the GitHub secret
  `NEXT_PUBLIC_STREAMING_MOVIES_API_URL` (+ optional `_QUERY`).

Verified: vitest 310/310 (12 new), lint clean on touched files, dev server
renders `/movies/550` and `/tv-shows/1396` 200, env values textually inlined
in client chunks. Committed on a local branch — NOT pushed, so prod still
serves vidscme as Server 1 until the secrets flip.

## Mistakes

- **Chased Vidlink's raw streams for an hour past the useful point.** The API
  (`api/b/movie/{wasm-token}`) is open, but every source now comes back
  `requiresProxy:true` behind `noon.mooncase.online`, which answers ACAO:* on
  its error pages yet 403s any non-vidlink Origin before proxying. Even
  reconstructing their exact proxy URL scheme from chunk 3922 didn't matter —
  the origin gate sits in front. Should have read the docs' postMessage
  section FIRST; the integration answer was documented on their homepage all
  along.
- **Trusted my memory of the site's routes** and curled `/movie/550` (the
  PROVIDER path shape) instead of `/movies/550` — burned two dev-server round
  trips on a 404 that was my own URL confusion.
- **Two failed attempts at a detached dev server** (`Start-Job` died with its
  shell; `Start-Process pnpm` failed — pnpm is not a Win32 binary). What
  works on this box: `cmd /c start /b cmd /c "... && pnpm dev > log 2>&1"`.

## What worked

- **Reading the provider's own marketing page as API docs.** Vidlink's
  homepage documents the event contract, data shapes and customization params
  completely; the reverse-engineered repos only mattered for proving what we
  did NOT need.
- **Capability detection by message shape, never by host.** The bridge
  activates for whatever plays; providers that publish nothing cost one idle
  listener. Same trick keeps the repo public-safe.
- **Reusing the ReelyPlayer contract wholesale** (origin-from-URL +
  contentWindow identity + writePosition/clearPosition) meant zero new
  storage concepts and instant test parity.

## Rules

- Embed providers are screened for TWO contracts now: playable video AND
  published progress events. The second is what makes the UX rich; prefer
  providers that publish one (Vidlink) over marginally cleaner players that
  don't.
- Never reconstruct a provider's private proxy chain for playback — if their
  proxy gates origins, that gate applies to us too. The docs' front door
  beats the bundle's back door.
- Per-slot `*_QUERY` vars are the only sanctioned way to customize an embed;
  blind params risk breaking signed URLs on other providers.
- On this machine, a background dev server survives tool calls only via
  `cmd /c start /b`; PowerShell jobs die with the shell.
