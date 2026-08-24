# Feature tracker — acquisition features sprint

Agreed scope: make Reely stickier and more shareable. Four features:
**Reels → Mood picker → Match Night → Watch Together (beta)**. Arabic RTL was
explicitly deferred. This file is the source of truth for what exists, where
it lives, and what state it is in.

Status legend: ✅ done & live · 🔶 built & live, needs one manual look

---

## Shipped earlier this sprint

| Item                                                                                                    | Status  | Where                                      |
| ------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| Deploy plumbing: every stream-slot env var forwarded into the CI build                                  | ✅ live | `49f6e35`, `93b13e2`                       |
| Server slots 3 (vidlink.pro) + 5 (vidfast.pro) filled after HTTP screening                              | ✅ live | `6a534f8`                                  |
| Player control suite: quality/speed/audio popovers, seek fixes, double-tap ±10s, click-anywhere dismiss | ✅ live | reely-pro-player `71713aa`, `246b483`      |
| Header slimmed: Watch History out of the nav (link lives inside the Watchlist page)                     | ✅ live | `config/site.ts`, `app/watchlist/page.tsx` |

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

**Reworked 2026-08-23 (second pass).** The first version stuttered and the
mute button restarted the trailer:

- Active slide comes from an **IntersectionObserver**, not an `onScroll`
  handler. The old handler ran `setActiveIndex` on every scroll tick, which
  re-rendered every mounted slide per frame.
- **Mute is a `postMessage`** to the player (`enablejsapi=1`), not a new
  `src`. Rewriting the src tore the iframe down and restarted playback from
  zero. Mute is also feed-wide now: scrolling no longer silently re-mutes.
- The still behind the trailer is the **portrait poster at w500**, not the
  landscape backdrop at w-2560, and only slides within one of the active one
  mount it at all.
- `getNextPageParam` terminates on a short page. It used to return
  `pages.length + 1` unconditionally, so the feed kept asking for pages that
  could only come back empty — 11 TMDB subrequests each.
- Keyboard control (arrows page the feed, `M` mutes, Escape leaves focus),
  an error state with retry, and a first-run swipe affordance.

## 2. Mood picker (`/mood`)

Eight curated moods → discover presets. No new backend: each mood compiles
to the existing `/api/filter` discover call (genre cocktail + rating floor

- vote-count floor).

* `lib/moods.ts`: cozy, adrenaline, mind-bending, laugh, cry, scare,
  true story, escape.
* Page: mood chips, infinite grid. Nav entry + sitemap entry. **Live**: 200.
* **2026-08-24**: the grid is `components/media/discover-grid.tsx`, now
  shared with the genre pages instead of copied from them — two columns on
  a phone like every other list, and TMDB's cross-page duplicates deduped.
  Mood cards align (`flex-col`; a button centres its content when the grid
  stretches it) and picking one scrolls its results into view.

## 3. Match Night (`/match-night`)

Two people, one 6-char room code, one deck; mutual likes light up as matches.
Anonymous by design — the room code is the credential, rooms swept after 12h.

- Migration `0008_match_together.sql` — applied to remote D1 and local.
- Worker routes: `/api/match/room`, `/api/match/swipe`, `/api/match/matches`.
  Matches are derived in SQL (`COUNT(DISTINCT swiper) >= 2`), never stored —
  nothing to reconcile.
- Pure core `lib/match-night.ts` (`resolveMatches`, `interleave`,
  `toMatchCard`, `dedupeCards`) + unit tests (suite: 330/330 green). Room
  state via `hooks/use-match-room.ts` (useSyncExternalStore).
- Nav entry + sitemap entry.
- **Prod-verified end-to-end by curl**: room `YJVSGL` → alice likes 123 →
  bob likes 123 → `{"matches":[{"media_id":123,"likers":2}]}`.

**Redesigned 2026-08-23 (second pass).** Reported as "so bad, laggy" with no
way to search. All three causes were client-side:

- **A swipe no longer awaits its POST.** The deck advances immediately and the
  swipe is reported in the background. Matches are derived on read, so the
  client was never the source of truth and the await bought nothing.
- **Posters go through `getPosterImageURL` (w500)**, not `getImageURL`
  (`tr:w-2560`), and three cards are mounted at once — the two behind the top
  card ARE the preloader for the next two posters.
- **The keyboard effect has a dependency array.** It had none, so it
  re-attached a window listener on every render, including the poll's.
- **Search shipped** (`components/match-night/deck-search.tsx`): any title
  from `/api/search` is queued as the NEXT card. Same endpoint the command
  menu uses, no new TMDB traffic.
- **The match panel shows posters**, resolved from this browser's own likes (a
  match requires your like, so the artwork is always already local — zero extra
  requests), plus a presence line from a distinct-swiper count returned in the
  same `db.batch` as the matches.
- **Drag to swipe** (framer-motion) with live Yes/Nope verdict stamps, plus
  buttons and arrow keys. **Undo** works because `/api/match/swipe` now
  upserts last-verdict-wins; `DO NOTHING` had made a vote unchangeable.
- Deck is ~80 titles (two pages each of popular movies and series), the invite
  is a `?room=CODE` link through the native share sheet, and the match poll is
  paced by activity (4s swiping / 15s idle, parked entirely in a background
  tab) to keep Worker invocations down.

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
- Start page: search a title → mint a room → land on the detail page
  carrying the code (`components/media-search-picker.tsx`, shared with
  Match Night; the pasted-link flow is gone — you were on Reely to begin
  with). Sitemap entry; deliberately not in the nav.
- **2026-08-24**: a guest polls the room from page load (only a hidden tab skips a poll), shows where the host is, acts on each beat exactly once, and stops for good on a 404 with "the room has ended". The bar mounts with the page, not with the player, so the
  host can send the invite before pressing play and a guest can see the
  room exists. The guest poll idles while there is no frame to steer.
- **Prod-verified by curl**: room `U5LDD3` → beat `{position:742.5,
playing:true}` → state round-trips exactly.

---

## 5. The Reely Player (private worker, `reely-pro-player`)

Supporter-only house player. **2026-08-24**, all measured:

- **Subtitles work, and there are fifty of them.** Measured from the Cloudflare
  edge (a throwaway worker under `wrangler dev --remote`): every OpenSubtitles
  download host answers a Worker with **401 "Making sure you're not a bot"**,
  whatever the user-agent, while search answers 200 — so the provider that led
  the chain could search perfectly and never return a file. The chain is now
  **Stremio's OpenSubtitles v3 addon** (one JSON call + one UTF-8 .srt, the
  whole OpenSubtitles catalog, served from a host that answers), then SubDL's
  website walk, then **SubtitleCat** — the one source that machine-translates,
  which is how languages no uploader covers resolve at all — then Podnapisi.
  Measured end-to-end through the worker's own route (self-signed ticket, all
  fifty languages): **43/50 Dune: Part Two, 46/50 Breaking Bad S3E1, 43/50
  Parasite**, median 164-351ms cold — against 11 languages offered before. Every code, slug and label lives in one table
  (`src/languages.mjs`) read by all four providers, the resolve endpoint and the
  client bundle. A candidate must clear a media-aware cue floor (250 film / 100
  episode) so forced tracks and sign-and-song files stop counting as
  translations.
- **Every cached route was 500ing.** `cached()` built its stored copy with
  `new Response(res.body, res)`, which transfers the stream out of the response
  the route returns — the runtime then threw "Body has already been used" while
  serialising it, so subtitles AND stream resolve failed on every cache miss.
  Cache the clone, return the original. Subtitles measured 0/50 before this,
  43-46/50 after: the engine was never what was broken.
- **The IMDb id rides the ticket** (`im=tt…`). The deepest catalog is keyed by
  it and nothing else; Reely's detail pages already hold one because their TMDB
  request appends `external_ids`, so it costs no extra upstream call.
- **The play ticket is warmed on intent.** Hover, focus or touch on the play
  control mints it and opens the connection to the player origin, so the tap
  itself pays for neither (`lib/pro/ticket-cache.ts`; 45s freshness against a
  ~90s ticket, promise cached so a fast tap shares the one request).
- **One row per language** in both pickers, keyed on the language a track is
  in rather than its label — no more "English, English, English", and never a
  numbered "Subtitle 2".
- **Account prefs actually arrive.** They were read from Reely's localStorage
  from inside a cross-origin iframe (always null); they ride the ticket query.
- **Progress bar in full screen**: off by default, switchable in the player
  (per device) and in the account panel (synced, `mini` on the ticket).
- **One round trip less to first frame**: read routes accept the entry ticket
  as well as the play token, so the token exchange and the stream lookup leave
  together (measured: both at t+55ms).
- Finished VTTs are cached 30 days at the edge, keyed without the credentials,
  so the first viewer in a colo pays for the walk and nobody after them does.
  Every source is keyless on purpose — a shared free-tier key is a daily quota,
  not a supply.

## Deploy & verification state

- Main repo deploys: `ce31913` (features) → `8effed9` (fix: pass `env` into
  `handleApi` + POST pass-through past the GET guard) → `ca84a92` (tracker).
  All CI-green.
- Two bugs the prod smoke caught and killed: the worker's GET/HEAD guard
  405'd every new POST route, and `handleApi` had no `env` parameter (D1
  routes crashed). Both fixed in `8effed9`.
- Lessons: `lessons/2026-08-23-reels-mood-match-together.md` + index row.
- Watch Together's two 4s loops now skip hidden tabs, and the host skips a beat
  identical to the last one — a paused film in an open tab used to write the
  same D1 row every four seconds forever.
- Lint is clean on all four feature surfaces (the old Tailwind class-order
  warning in `app/reels/page.tsx` is gone with the rewrite).

## The one remaining manual pass (nice-to-have, not blocking)

Drive these on real hardware / a real browser tab pair:

1. Reels: native share sheet on a phone. ~~focus mode toggle~~ (done
   2026-08-24: real touch taps enter and leave it, and the phone back gesture
   now leaves full screen and lands on the feed instead of leaving Reels),
   ~~cover-crop look~~ (done: the trailer fills the frame, no letterbox).
2. ~~Match Night: two devices, one code, watch the match light up in the
   UI.~~ **Done 2026-08-24** — a browser room plus a curl second swiper:
   the panel lit up with the poster and "2 people swiping", a toast fired
   for each new match (one film, one series, proving the type+id key), and
   a reload announced neither of them again.
3. Watch Together: **guest half done 2026-08-24** — a real guest tab with a
   spy on the player frame took `{kind:'play',t:1200}` and then
   `{kind:'pause',t:1500}` from curl'd host beats, showed the host clock,
   and pushed each beat exactly once across three poll cycles. What is left
   is the host half on a real playing stream (an embed emits nothing under
   automation).

## Deliberately deferred

- Arabic/RTL support (user decision).
- Match Night drag-swipe gestures (buttons + arrows first).
- Watch Together presence/roster (code is the only credential for now).
