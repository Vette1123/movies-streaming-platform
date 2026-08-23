# Feature tracker — acquisition features sprint

Agreed scope: make Reely stickier and more shareable. Four features, in
order: **Reels → Mood picker → Match Night → Watch Together (beta)**.
Arabic RTL was explicitly deferred. This file tracks every piece, its state,
and what remains before it can be called done.

Status legend: ✅ done · 🔶 built, unverified · ⬜ not started

---

## Shipped earlier this sprint

| Item | Status | Where |
| --- | --- | --- |
| Deploy plumbing: every stream-slot env var forwarded into the CI build | ✅ live | `49f6e35`, `93b13e2` |
| Server slots 3 (vidlink.pro) + 5 (vidfast.pro) filled after HTTP screening | ✅ live | `6a534f8` |
| Player control suite: quality/speed/audio popovers, seek fixes, double-tap ±10s, click-anywhere dismiss | ✅ live | reely-pro-player `71713aa`, `246b483` |
| Header slimmed: Watch History out of the nav (link lives inside the Watchlist page) | ✅ built | `config/site.ts`, `app/watchlist/page.tsx` |

---

## 1. Reels — trailer feed (`/reels`)

Swipeable full-screen trailer feed from TMDB trending. One Worker route,
one service, one client page.

| Piece | Status | Notes |
| --- | --- | --- |
| `services/reels.ts` (trending → ReelItem, per-title `/videos` because trending ignores `append_to_response` — measured) | ✅ | 11 subrequests/batch, 24h cache |
| Worker route `/api/reels` | ✅ | `cloudflare/worker.js` |
| `getReelsApi` + `REELS_KEY` | ✅ | |
| Feed page: snap scroll, active-slide-only iframe, infinite batches | ✅ | browser-verified: 10 slides, snap = exactly 1 viewport, iframe swaps on scroll, watchlist heart toggles |
| Full-bleed layout: `h-dvh`, footer hidden via `body:has(.reels-viewport)`, no window scrollbar | ✅ | browser-verified: viewport = innerHeight, footer display:none |
| Trailer cover-crop (`.reel-frame`: 16:9 scaled to cover, YouTube title overlay crops offscreen) | 🔶 | CSS shipped, not re-verified in browser |
| Focus mode: expand button → header hides (`body:has(.reels-focus)`), Watch-now only, Esc exits | 🔶 | shipped, not browser-verified |
| Share button (native Android/iOS sheet via `hooks/use-share.ts`, clipboard+toast fallback) | 🔶 | hook is the app-wide share primitive now |
| Nav entry + sitemap entry | ✅ | |

## 2. Mood picker (`/mood`)

Eight curated moods → discover presets. No new backend: compiles to the
existing `/api/filter` call.

| Piece | Status | Notes |
| --- | --- | --- |
| `lib/moods.ts` (8 moods, genre cocktails + rating floors) | ✅ | |
| `/mood` page: mood chips, infinite grid reusing `Card` + GenreMediaGrid's scroll pattern | 🔶 | typecheck+lint clean, not browser-verified |
| Nav entry + sitemap entry | ✅ | |

## 3. Match Night (`/match-night`)

Two people, one 6-char room code, one trending deck; mutual likes light up
as matches. Anonymous by design; rooms swept after 12h.

| Piece | Status | Notes |
| --- | --- | --- |
| Migration `0008_match_together.sql` (match_rooms, match_swipes, together_beats) | ✅ | applied to remote D1 and local |
| Worker routes: `/api/match/room`, `/api/match/swipe`, `/api/match/matches` (matches derived in SQL, never stored) | 🔶 | |
| `lib/match-night.ts` pure core (`resolveMatches`, `interleave`) + 8 unit tests | ✅ | 330/330 green |
| `hooks/use-match-room.ts` (useSyncExternalStore, no setState-in-effect lint debt) | ✅ | |
| Page: create/join room, keyboard + button swiping, live match panel, invite copy | 🔶 | not browser-verified |
| Nav entry + sitemap entry | ✅ | |

## 4. Watch Together beta (`/watch-together`)

Host's position beats to D1 every 4s; guests drift-correct (>3s) via
postMessage into the player frame.

| Piece | Status | Notes |
| --- | --- | --- |
| Player: inbound `reely-together` seek/play/pause + outbound `time` ticks every 2s | ✅ pushed | reely-pro-player `5972dbd` — CI deploying |
| Worker routes: `/api/together/room`, `/api/together/beat`, `/api/together/state` | 🔶 | same migration as above |
| `components/watch-together-bar.tsx` (host relays, guest corrects) mounted in `DetailsHero` when `?watch=CODE` | 🔶 | read from `window.location` in useMemo — never `useSearchParams`, which would deopt ~1000 prerendered heroes |
| `/watch-together` start page (paste link → room → detail page with code) | 🔶 | |
| Sitemap entry | ✅ | deliberately not in the nav — reached from the start page |

---

## Ship state (2026-08-23)

1. Deployed: `ce31913` (features) + `8effed9` (env-into-handleApi + POST
   pass-through fix) — both CI-green. Player bridge live via
   reely-pro-player `5972dbd`.
2. D1 migration `0008_match_together.sql` applied remote + local.
3. Production-verified by curl: `/reels` + `/api/reels` live, `/mood`
   `/match-night` `/watch-together` all 200, match room → two swipes → match
   derived (`{"matches":[{"media_id":123,...,"likers":2}]}`), together room →
   beat → state round-trips positions.
4. Lessons written (`lessons/2026-08-23-reels-mood-match-together.md`).
5. Still worth one manual browser pass: reels focus mode / share sheet /
   cover-crop on real hardware, and the two-tab match + together flows
   (API-verified, UI not yet driven end-to-end).

## Deliberately deferred

- Arabic/RTL support (user decision).
- Match Night drag-swipe gestures (buttons + arrows first).
- Watch Together presence/roster (code is the only credential for now).
