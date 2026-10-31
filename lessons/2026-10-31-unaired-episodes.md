# Unaired episodes looked watched and could be played

## What

A season with future episodes showed flat grey boxes, a dim number, and on touch
a dark filled tick that read as "watched". Tapping one started an embed that had
nothing to play, and because starting an episode ticks every earlier one, it also
recorded other unaired episodes as watched.

An episode dated after the visitor's today now has no play button and no tick
(unless it was ticked, so that can be undone), a chip with the date, and a quiet
title. With no still it uses the dimmed series backdrop, for every card, which is
one image request. The tick on an unwatched card is a hollow outline everywhere.
`unairedEpisode` in `lib/airing.ts` sits on the same day count as `airingLabel`.

## Mistakes

- I planned a new date helper before reading `lib/airing.ts`, which already had the
  visitor's-calendar logic and its timezone tests.
- The brief was grey boxes. The real bug was the tap, found only by reading what
  `handleWatchEpisode` does after `requestPlay`.
- My first helper re-derived "today" and matched on label text. A shared
  `daysUntil` removed both.
- `/api/season-details` is Worker-only, so `pnpm dev` 404s and the list never
  renders. I took the empty list for a hang in my change until the dev log said so.
- Claude in Chrome screenshots timed out on every page after about 10s, so I
  burned rounds re-trying it. Headless Chrome over CDP with a temporary route
  gave exact widths, touch emulation and worst-case data in one script.

## What worked

- A temporary, uncommitted `app/api/season-details/route.ts` puts worst-case data in
  at the real boundary.
- 320px at a 200% root font found the fixed `w-36` thumb squeezing out the text;
  `max-w-[45%]` fixed it in the shared card.

## Rules

- Read what a tap does after its first line. The damage can be in the bookkeeping.
- "Airs today" stays playable: TMDB's date is the US premiere with no hour.
- Grep `lib/` for the concept before writing a date helper.
- When Chrome screenshots stall, drive headless Chrome over CDP instead of retrying.
