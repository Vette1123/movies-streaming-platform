# 2026-08-23 — Reels, Mood, Match Night, Watch Together

## What

Four acquisition features shipped in one unit:

- **Reels** (`/reels`): full-screen swipeable trailer feed. Worker route
  `/api/reels` → `services/reels.ts` (trending page → per-title `/videos`).
  Focus mode, native share, cover-cropped YouTube embeds.
- **Mood picker** (`/mood`): 8 curated moods compiling to existing
  `/api/filter` discover calls. No new backend surface.
- **Match Night** (`/match-night`): anonymous 6-char rooms in D1, swipe deck,
  matches derived in SQL (`COUNT(DISTINCT swiper) >= 2`), never stored.
- **Watch Together beta**: host position beats → D1 every 4s; guests poll and
  postMessage seek/play/pause into the player frame; the player (reely-pro-player
  `5972dbd`) gained the inbound contract plus 2s `time` ticks.
- Also: header slimmed (Watch History → link inside Watchlist), `hooks/use-share.ts`
  is now the one share primitive, `FEATURES.md` tracks the sprint.

## Mistakes

1. **Assumed TMDB trending supports `append_to_response=videos`.** It silently
   ignores it — zero videos in the response, empty feed. Verified with a raw
   curl before rewriting: trending needs one `/videos` call per title (capped
   at 10/batch, 24h cached).
2. **Sed-replaced a className string that appeared on THREE buttons** — put
   `data-testid="reel-save"` on the play link and mute button, not the save
   button. Bulk string replace on JSX is a footgun; use Edit with context.
3. **`h-[calc(100dvh-4rem)]` guessed the header height** and the sticky footer
   pushed the document taller than one viewport — window scroll fought the
   snap scroll and the scrollbar reflected footer space. Fix: exact `h-dvh`,
   footer/header hidden via `body:has(...)` selectors, not height math.
4. **YouTube embeds letterbox inside portrait iframes** — the 16:9 video left
   a dead band at top where YouTube's own title overlay sat, cut off. Fix is
   the object-fit-cover trick by hand (`.reel-frame`: width
   `max(100vw, 177.78dvh)`, height `max(56.25vw, 100dvh)`, centered).
5. **`useSearchParams` in DetailsHero would have deopted ~1000 prerendered
   detail heroes.** Read `window.location.search` in a useMemo instead — the
   bar only mounts after a client-side play click, so no hydration risk.
6. **The new React lint rule (no sync setState in effects)** rejected two
   "load once from storage" effects. The compliant pattern is
   `useSyncExternalStore` (see `hooks/use-match-room.ts`) or deriving during
   render — not effect+setState.
7. **`build:cf` "succeeded" in 59ms** — `next build` inside it had died
   instantly because the dev server held `.next/` (same EBUSY class as the
   `out/` lock). Always check for the exported pages (`out/<route>`) rather
   than trusting the worker-bundle "Done" line.
8. **ArtPlayer has `.playing`, not `.paused`** — TS caught it, but the
   instinct came from the DOM API. ArtPlayer API, not HTMLVideoElement.

## What worked

- Browser-harness assertions caught the real state every time the visual
  check lied (snap scroll measured `scrollTop === clientHeight` exactly).
- Deriving matches in SQL instead of storing a matches table means nothing
  can drift; the pure `resolveMatches` twin is unit-tested (330/330).
- `body:has()` CSS for hiding site chrome on one route — no layout
  rewrites, no context plumbing, reversible.
- Reusing `/api/filter` for moods and `Card`/GenreMediaGrid patterns meant
  the mood page has zero new server code.

## Rules

- TMDB: never assume `append_to_response` works outside detail endpoints —
  verify per endpoint with curl.
- Full-screen feeds: size to `dvh`/`svh` exactly and hide chrome with
  `body:has()`; never calc-guess chrome heights.
- Third-party iframes in portrait containers: scale to cover, crop the
  overflow — letterboxing exposes their overlay chrome.
- New client pages under static export: no `useSearchParams` at render time;
  read location in effects/memo.
- After any `build:cf`, verify `out/<new-route>` exists before believing it.
