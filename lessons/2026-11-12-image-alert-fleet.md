# The image-host alert fired for a bot fleet, not an outage

## What

"Spike — image host down for more than 15 people a day" fired on 2026-11-11 with 20 people. wsrv.nl was up:
`pnpm images:check:live` returned 200 on every stage.

- All 20 were Chrome on Windows. 43 of 64 people at 1920x1080 fell back, against 0 of 34 people on every other
  screen size.
- 1 of the 20 ever clicked, searched or played. On the real wsrv blip of 2026-10-30, 19 of 33 did.
- The fleet always reports `en-US` and a direct visit, but rotates country, timezone and Chrome version, and
  real people share its screen. No ingest-time property separates it.

Fix: `image_host_fallback` waits for the visitor's first pointer or key press (`lib/interaction-gate.ts`). A real
outage still crosses 15, and a fleet that never presses anything never reports.

## Mistakes

- First instinct was to lower the alert threshold once the noise was gone. Alerts are matched by NAME in
  `upsertAlert`, and the name carries "15", so a new threshold would have left the old alert running beside a new
  one. The 10-30 blip clears 15 after the gate anyway, so the threshold stayed.
- Timezone-vs-country mismatch looked like the fleet's tell, but real VPN users mismatch too. Behaviour was the
  only clean split.

## Rules

- Before acting on an infrastructure alert, ask whether the people behind it ever convert.
- An alert about real people should count people who interacted, not sessions that merely loaded.
