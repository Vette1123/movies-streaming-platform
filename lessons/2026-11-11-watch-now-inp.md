# Watch Now paints before the player swap

## What

Search Console rates every mobile URL "Poor" on INP (> 500 ms). In PostHog, mobile p75 went from
176 ms (week of 10-04) to 416 ms (11-08). By target, the worst were Watch Now (`button.bg-primary-fill`,
692 ms) and its label (`span.tabular-nums`, 620 ms): they are the same button.

The click handler did the whole player swap synchronously: tracking, the watch-history write, then
`setPlaying(true)`. That moves the hero copy out through AnimatePresence, brings the player stage in
and creates the iframe, all inside the frame INP measures. `lib/after-paint.ts` (`afterNextPaint`:
rAF, then a task, with a 100 ms timeout for hidden tabs) now runs that work after the press has
painted.

Galaxy A73, dev build, Watch Now on `/movies/550`, 4 taps each:

|               | total      | processing | presentation |
| ------------- | ---------- | ---------- | ------------ |
| sync (before) | 160–176 ms | 27–33 ms   | 99–106 ms    |
| after paint   | 88–120 ms  | 1 ms       | 64–83 ms     |

Playback still starts on both a movie and a series (iframe src set, history written).

## Mistakes

- I suspected PostHog init, the view transition and the blur/parallax effects before measuring the
  tap itself. On the phone, a tap that changes nothing was 32–48 ms with or without blur and effects.
  The cost was in what the tap rendered, not in what was running in the background.
- I read `span.tabular-nums` in the field data as the rating count-up. It is the Watch Now label.
  Check what a selector is before guessing what it belongs to.
- I assumed a poster tap from a details page was a client navigation. For a tail id it is a full
  document load: there is no RSC payload (`.txt` 404s) and Next falls back. That is by design, and it
  is why the field shows "removed element" targets.

## What worked

- Driving the phone's Chrome over CDP (`adb forward tcp:9333 localabstract:chrome_devtools_remote`),
  dispatching real touch events and reading Event Timing plus LoAF entries. An A/B by injected CSS
  or JS (`Page.addScriptToEvaluateOnNewDocument`) separates causes in minutes.
- A baseline taken on the same build: the dev server with the handler made synchronous again.

## Rules

- A click that mounts something heavy paints its press first: `afterNextPaint(work)`.
- Read input state (the URL, the target) at click time and pass it in, so the deferred run cannot
  see a later state.
- Attribute INP by tapping the real target on a real phone before changing anything around it.
