# Feature tracker — acquisition features sprint

Agreed scope: make Reely stickier and more shareable. Four features:
**Reels → Mood picker → Match Night → Watch Together (beta)**. Arabic RTL was
explicitly deferred. This file is the source of truth for what exists, where
it lives, and what state it is in.

Status legend: ✅ done & live · 🔶 built & live, needs one manual look

---

## Shipped earlier this sprint

| Item | Status | Where |
| --- | --- | --- |
| Deploy plumbing: every stream-slot env var forwarded into the CI build | ✅ live | `49f6e35`, `93b13e2` |
| Server slots 3 (vidlink.pro) + 5 (vidfast.pro) filled after HTTP screening | ✅ live | `6a534f8` |
| Player control suite: quality/speed/audio popovers, seek fixes, double-tap ±10s, click-anywhere dismiss | ✅ live | reely-pro-player `71713aa`, `246b483` |
| Header slimmed: Watch History out of the nav (link lives inside the Watchlist page) | ✅ live | `config/site.ts`, `app/watchlist/page.tsx` |

---

## 1. Reels — trailer feed (`/reels`)

Swipeable full-screen trailer feed from TMDB trending. Worker route
`/api/reels` → `services/reels.ts` (trending page → per-title `/videos`,
because trending ignores `append_to_response` — measured, not guessed).

- Feed: snap scroll, one viewport per reel, active-slide-only iframe,
  infinite batches, watchlist heart. Browser-verified.
- Full-bleed: exact `h-dvh`, footer hidden via `body:has(.reels-viewport)`,
  no window scrollbar. Browser-verified.
- Trailer cover-crop (`.reel-frame`): 16:9 scaled to cover portrait, so
  YouTube's own title overlay crops offscreen.
- Focus mode: expand button → header hides (`body:has(.reels-focus)`),
  Watch-now only, Escape exits.
- Share: native Android/iOS sheet via `hooks/use-share.ts` (the app-wide
  share primitive now), clipboard + toast fallback on desktop.
- Nav entry + sitemap entry. **Live**: `/reels` 200, `/api/reels` returning
  real trending data in production.

## 2. Mood picker (`/mood`)

Eight curated moods → discover presets. No new backend: each mood compiles
to the existing `/api/filter` discover call (genre cocktail + rating floor
+ vote-count floor).

- `lib/moods.ts`: cozy, adrenaline, mind-bending, laugh, cry, scare,
  true story, escape.
- Page: mood chips, infinite grid reusing `Card` + the GenreMediaGrid
  scroll pattern. Nav entry + sitemap entry. **Live**: 200.

## 3. Match Night (`/match-night`)

Two people, one 6-char room code, one trending deck; mutual likes light up
as matches. Anonymous by design — the room code is the credential, rooms
swept after 12h.

- Migration `0008_match_together.sql` — applied to remote D1 and local.
- Worker routes: `/api/match/room`, `/api/match/swipe`, `/api/match/matches`.
  Matches are derived in SQL (`COUNT(DISTINCT swiper) >= 2`), never stored —
  nothing to reconcile.
- Pure core `lib/match-night.ts` (`resolveMatches`, `interleave`) + 8 unit
  tests (suite: 330/330 green). Room state via `hooks/use-match-room.ts`
  (useSyncExternalStore).
- Page: create/join room, button + arrow-key swiping, live match panel,
  invite copy. Nav entry + sitemap entry.
- **Prod-verified end-to-end by curl**: room `YJVSGL` → alice likes 123 →
  bob likes 123 → `{"matches":[{"media_id":123,"likers":2}]}`.

## 4. Watch Together beta (`/watch-together`)

Host's position beats to D1 every 4s; guests poll and drift-correct (>3s)
via postMessage into the player frame.

- Player bridge (reely-pro-player `5972dbd`, CI-deployed): inbound
  `reely-together` seek/play/pause, outbound `time` ticks every 2s.
- Worker routes: `/api/together/room`, `/api/together/beat`,
  `/api/together/state` (same migration as Match Night).
- `components/watch-together-bar.tsx` mounted inside `DetailsHero` when the
  URL carries `?watch=CODE` — host relays, guest corrects. Read from
  `window.location` in a useMemo, never `useSearchParams` (would deopt
  ~1000 prerendered detail heroes).
- Start page: paste a Reely link → mint a room → land on the detail page
  carrying the code. Sitemap entry; deliberately not in the nav.
- **Prod-verified by curl**: room `U5LDD3` → beat `{position:742.5,
  playing:true}` → state round-trips exactly.

---

## Deploy & verification state

- Main repo deploys: `ce31913` (features) → `8effed9` (fix: pass `env` into
  `handleApi` + POST pass-through past the GET guard) → `ca84a92` (tracker).
  All CI-green.
- Two bugs the prod smoke caught and killed: the worker's GET/HEAD guard
  405'd every new POST route, and `handleApi` had no `env` parameter (D1
  routes crashed). Both fixed in `8effed9`.
- Lessons: `lessons/2026-08-23-reels-mood-match-together.md` + index row.
- Known lint debt: one Tailwind class-order warning in `app/reels/page.tsx`
  (cosmetic, auto-fixable with `pnpm exec eslint --fix`).

## The one remaining manual pass (nice-to-have, not blocking)

Drive these on real hardware / a real browser tab pair:

1. Reels: focus mode toggle, native share sheet on a phone, cover-crop look.
2. Match Night: two devices, one code, watch the match light up in the UI
   (API flow already proven).
3. Watch Together: two devices, host seeks, guest follows (API round-trip
   already proven; needs a playing stream to see the drift correction).

## Deliberately deferred

- Arabic/RTL support (user decision).
- Match Night drag-swipe gestures (buttons + arrows first).
- Watch Together presence/roster (code is the only credential for now).
