# Slow taps get named scripts

## What
Mobile INP on Reely is p75 368 ms on `/` (8 of 55 reports poor). Over 14 days
the slowest mobile taps were the episode cards (`button.-inset-1.5`, p75 1,950
ms), the primary button (648 ms), the menu icon (806 ms, 362 ms of handlers)
and the player (`#video`, 569 ms of paint). posthog-js INP attribution names
the element but drops the long-animation-frame scripts, so none of them says
what ran. `lib/slow-interactions` (ported from the downloader, where it named
PostHog's own dead-click handler at 348 ms on its first day) now sends
`slow_interaction` (area health, at most 3 per page) for any tap of 500 ms or
more, with the element, seconds since load, whether the page went hidden, and
the top three scripts. Read it with
`SELECT properties.target, properties.top_scripts, properties.duration_ms FROM events WHERE event='slow_interaction'`.

## Mistakes
- The episode-card number looked like a 1.1 s handler. One report of 8.7 s
  (6.2 s of handlers, one session) was carrying the mean; the other seven sat
  at 300-440 ms with 25-230 ms of handlers. Read the rows before the average.
- The scripted insert put the type import inside the file's header comment,
  because the comment contains the word "import". Anchor on `^import`, not on
  the first occurrence.

## What worked
Grouping field INP by `interactionTarget` with processing/presentation/input
delay split, before opening any component.

## Rules
- No fix for a slow tap until the field names the script behind it.
- When a diagnostic lands in one project, port it to the sister project the
  same day rather than guessing there.
