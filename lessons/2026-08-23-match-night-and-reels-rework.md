# Match Night and Reels: the rework after the first real use

Date: 2026-08-23
Area: `app/match-night`, `app/reels`, `components/match-night/*`,
`components/watch-together-bar.tsx`, `cloudflare/worker.js`

## What

Both features shipped earlier the same day and were verified by curl against
production. The first person to actually _use_ them called Match Night "so bad,
laggy" and asked why nothing could be searched, and reported a console full of
errors on Reels. Everything they reported was real except the console errors,
which were somebody else's code entirely.

Shipped in this pass:

- Match Night rebuilt as a physical swipe deck (framer-motion drag, verdict
  stamps, three-card stack), plus in-deck search, a real match panel with
  posters, presence, undo, deck of ~80, and a shareable `?room=CODE` link.
- Reels: active slide from an IntersectionObserver instead of a scroll handler,
  mute over the YouTube postMessage API instead of a fresh `src`, portrait
  poster stills at w500 instead of landscape backdrops at w-2560, feed-wide mute
  preference, keyboard control, an error state, and a terminating
  `getNextPageParam`.
- Worker: `/api/match/matches` returns the room's distinct swiper count in the
  same `db.batch`, and `/api/match/swipe` upserts last-verdict-wins.
- Watch Together: both 4s loops skip hidden tabs, and the host skips a beat that
  has not moved.

## Mistakes

**"Laggy" was three separate self-inflicted things, and none of them were the
network.** The instinct was to look at the API. The API was fine.

1. `swipe()` awaited the POST before `setIndex`. Every card change was gated on
   a round trip to the Worker and D1. The fix is that a swipe is a local fact:
   advance first, report after. The room is derived in SQL on read, so it was
   never possible for the client to be the source of truth anyway - the await
   bought exactly nothing and cost every interaction.
2. The card poster went through `getImageURL`, which is `originalImage`:
   `tr:w-2560`. A 288px card was being handed a 2560px file, one fresh fetch per
   swipe, with no next card mounted to warm the next one. Same mistake as the
   detail-page blurry bug from July, in the other direction: that one measured
   what the image PAINTS; this one never measured at all.
3. The keyboard effect had no dependency array. It tore down and re-attached a
   window listener on every render, and the four-second match poll guaranteed a
   render every four seconds forever.

**The console errors were not ours and I nearly went looking anyway.**
`GmailAcrobatFteCoachmark`, `showOneChild`, `content-script-idle.js`,
`ch-content-script-dend.js`, "a listener indicated an asynchronous response" -
every one of those is a Chrome extension content script. The font intervention
and the WebGPU `powerPreference` warning come from inside YouTube's iframe. The
one line that IS ours, `beforeinstallprompt.preventDefault()`, is the PWA
install prompt behaving exactly as designed. Read the emitting file name before
believing a stack trace belongs to you.

**`ON CONFLICT DO NOTHING` quietly made undo impossible.** The original swipe
insert was written so that "re-swiping re-affirms the first choice", which
sounds careful and is wrong: it means no client can ever take a vote back. That
was not discovered by reasoning about the SQL, it was discovered by trying to
build undo on top of it. A vote table wants last-verdict-wins.

**A count was shipped where a picture was needed.** The match panel said "2
titles you both want" and showed neither. The information to show them was
already on the device: a match requires YOUR like, so the poster for one is
always something this browser has already rendered. The panel needed no new
endpoint and no new TMDB traffic - it needed the likes written down.

**Two lint rules caught two real React bugs that read as fine.** `setState`
inside an effect on `room` (should be adjusted during render), and a
`ref.current = x` assignment during render. Both were written on autopilot.

## What worked

- Deriving matches in SQL. Changing the swipe upsert to last-verdict-wins fixed
  undo everywhere at once, with no reconciliation, because nothing is stored.
- `db.batch` for the matches poll: two answers, one round trip, and the presence
  count is what turns an empty panel from ambiguous into informative.
- Pacing the poll by activity (4s while swiping, 15s once quiet, and TanStack
  already parks it in a background tab). An idle room went from 900 invocations
  an hour to 240 against a 100k/day account cap.
- The three-card stack is the preloader. Two decorative cards behind the top one
  are also exactly the two next posters, decoded before they are needed. Nothing
  had to be written for it.
- `enablejsapi=1` plus one `postMessage` gives mute control without loading
  YouTube's iframe API script, and without rebuilding the player.

## Rules

- A user action that has a local answer must not await the network to show it.
  Report the action afterwards; if the server is the source of truth, that is an
  argument about the data model, not a reason to freeze the UI.
- Before shipping any `<img>`, name the builder and the painted size out loud.
  `getImageURL` is `w-2560`. Cards want `getPosterImageURL`, thumbnails want
  `getThumbPosterURL`.
- Never write an effect with no dependency array. A missing array is not "run
  every time it matters", it is "run every render".
- A vote, a rating, a preference: upsert last-write-wins. `DO NOTHING` is for
  idempotent inserts, not for anything a person can change their mind about.
- Attribute a console error to its emitting file before touching code.
  Extension content scripts and third-party iframes produce most of what a user
  screenshots.
- Any recurring `setInterval` that talks to the Worker checks `document.hidden`
  and skips a payload identical to the last one. See
  [the CPU-by-route lesson](2026-08-20-worker-cpu-by-route.md) for why the
  invocation count matters more than the per-request cost.
