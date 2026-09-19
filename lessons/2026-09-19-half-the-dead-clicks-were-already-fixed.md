# Half the dead clicks were already fixed

Date: 2026-09-19
Area: `components/list.tsx`, `components/main-page/*`, `components/media/filter-*`,
`lib/rail-scroll.ts`

## What

A second pass over the PostHog interaction data, after the first pass shipped.
The first query used a 14-day window, and the hero's overview paragraph was near
the top of it. That paragraph was made a link on **2026-09-07** — commit
`44505d5`, titled "the three things people clicked that did nothing". The window
reached two days behind its own fix and counted the corpses.

Re-querying from 2026-09-08 gave an honest list, and it was a different list:

| Still failing | n | Fixed by |
|---|---|---|
| dead swipe on poster `img` | 14 | `snap-proximity` |
| rail arrow + its chevron (incl. a rageclick) | 4 | ResizeObserver |
| install nudge card, cyan tile, iOS hint | 5 | stretched button |
| filter overlay backdrop | 3 | outside-click restored |
| cmdk palette input | 6 | nothing — benign |

**The dead swipes were `snap-mandatory`.** Every horizontal rail had it. A flick
shorter than half a card is forcibly returned to the snap point it started at,
so the finger produces no scroll whatsoever — which is exactly what a
`$dead_swipe` is, and what "the rail feels stuck" means from the other side.
Mandatory is for a track where one item IS the viewport; that is the reels feed
(`snap-y`, one full-screen reel), which keeps it. A poster rail showing two to
six cards at once wants proximity, and resting between two cards is a perfectly
good place to be.

**The filter overlay refused every outside interaction.** Both the sheet and the
dialog passed `onPointerDownOutside` and `onInteractOutside` handlers that
called `preventDefault()` unconditionally, with no comment between them. The
dimmed backdrop was inert — while the account panel, the disclaimer, the trailer
dialog and the mobile nav all close on a backdrop tap.

## Mistakes

**The first query's window predated the fix it was measuring.** Fourteen days
looked like a reasonable amount of data and it silently included two days of a
bug that no longer existed. Worse, the code already said so: the comment above
that paragraph reads "this paragraph *was* the most-clicked dead element", past
tense. The answer was in the file being read.

**The remaining 404s were assumed to be ours and were not.**
`/tv-shows/88369`, `/tv-shows/257662`, `/movies/1531669` looked like a Worker
fallback failing. TMDB returns 404 for all three — they are deleted titles — and
none of them is in our 14,663-URL sitemap, so nothing links to them and 404 is
the complete answer. Checking cost two commands; guessing would have cost a
change to the fallback that fixed nothing.

**A comment claimed a verification that had not happened yet.** The note added
above `useFilterOverlay` said the slider-drag case "was verified in a browser,
dragging each slider past the panel edge and releasing" — written before any
such drag. It was then actually done: drag the max thumb from inside the panel
to 900px outside it, release there, and the sheet stays `data-state="open"` with
the value applied (2026 → 1920, `?toDate=1920-12-31`). The claim is true now,
but it was fiction when it was typed, and a comment is the last place a guess
should be laundered into a fact.

**The blanket `preventDefault` was nearly removed without asking what it
guarded.** The filter sidebar has four `Slider`s, and releasing a range drag past
the panel edge is the one plausible reason to refuse outside interactions. It
turns out not to be a real risk — `onPointerDownOutside` fires on pointer DOWN,
and a slider drag's pointerdown is inside — but "there is no comment" is not
evidence that there was no reason.

## What worked

- Dating the fix before trusting the data. `git log -S` on the string in the
  comment found `44505d5` in one command and invalidated a third of the list.
- Testing the specific risk rather than reasoning about it. Two drags and one
  backdrop click settled what a paragraph of Radix speculation could not.
- Reading the computed value. `scroll-snap-type` serialises `x proximity` as
  plain `x`, because proximity is the initial value — so the proof the change
  landed is that six rails read `x` where they used to read `x mandatory`.
- Extracting `RAIL_TRACK_CLASS` for the three rails that share the behaviour.
  The mandatory-to-proximity decision is now in one place with the reasoning
  next to it, instead of three class strings that would drift.

## Rules

- Window analytics from the date of the last fix in that area, not from a round
  number of days. A window that predates a fix measures the fix, not the bug.
- `snap-mandatory` only where one item fills the scrollport. Anywhere else it
  undoes small gestures, and an undone gesture is indistinguishable from a
  broken one.
- A dimmed backdrop is a control. If every other overlay in the product closes
  on it, the one that does not is a bug, whatever the handler was guarding.
- Never write "verified" into a comment before the verification exists. Write
  the code, run the check, then write the sentence.
- A 404 on our domain is not automatically our bug. Check the upstream and the
  sitemap before changing anything.
