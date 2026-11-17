# Episode cards still swapped the player inside the tap

## What
Mobile INP on `/tv-shows/*`, attributed by target (PostHog, 14 days). The
Watch Now button was fixed on 11 Nov (`ad9e259`, `lib/after-paint.ts`): TV
p75 for it went from 460 ms to 104 ms. The episode card's stretched button
(`button.-inset-1.5.absolute…` in `components/series/episodes.tsx`) never got
the same fix. Its click still called `requestPlay`, `router.push` and
`scrollToTop` synchronously, so the player swap landed in the frame INP
measures. Since the Watch Now fix, the card shows p75 4.5 s on 3 samples (and
296 ms on 21 before).

`lib/start-episode.ts` runs those three steps after the next paint, in the
same order, so play still comes before the URL push. Pinned in
`tests/start-episode.test.ts`: it was red with the synchronous helper and is
green with the deferred one.

## Mistakes
- The first INP pass (a subagent) stopped at "the Play button is already
  fixed". The 14-day window straddled that fix, and the per-target table
  mixed pre-fix and post-fix rows. The card was the one target that got
  worse after the fix, and it took a second look to read that as a missed
  sibling, not noise.
- The 11 Nov fix went into `play-button.tsx` alone. The sibling that does the
  same job (starting playback) stayed broken for six days.

## What worked
- Splitting attributed INP at the deploy date showed which targets the fix
  covered and which it missed.

## Rules
- A deferral fix for one play surface gets applied to every surface that
  starts playback. Grep for the player call (`requestPlay`, `startPlayback`),
  not just the component that was reported.
- Read field vitals split at the fix's deploy date, never across it.
