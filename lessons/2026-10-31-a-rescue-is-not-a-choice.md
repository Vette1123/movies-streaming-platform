# A rescue is not a choice

## What

The Reely Player was moving a viewer to Server 1 nine minutes into an episode with no word on screen, and automatic hops were replacing a chosen server. Reely now refuses to leave a stream that has played unless the viewer asks, and an automatic hop lasts for the visit and saves nothing. Each step of a stream failing is reported as `player_incident`, with a tripwire alert on hops off a playing stream.

## Mistakes

- `unavailable` meant "this never started" when it was written, and the hop code kept trusting it after the player could send it nine minutes in. The hop had no idea whether anybody was watching.
- An automatic hop used the same `select` as a click, so it wrote the title memory and, below supporter, the device default and the account setting. A rescue from one bad boot became a permanent preference.
- `player_failed` carried a source and a reason of `unavailable`. PostHog timed the failure to the millisecond and could not say what failed, so the actual stream error of 2026-10-31 is unknown.
- The first assumption was that today's subtitle change might be involved. It could not be: the overlay never reaches the hls.js error path.
- The first fix was declared safe from unit tests. `pnpm hop:probe` then found a reload during an outage resetting the position to 0, and "Try again" resuming near 100s from 500s.
- A sixth PostHog alert was added and rejected with a 400: the plan allows five. One combined tripwire replaced the two.

## What worked

- Reading one session's timeline. Two dead clicks seconds before the hop showed the picture had already stopped, which no aggregate would have shown.
- Failing requests at the browser network layer against the real page and real player. That is the only test that reached the position bugs.

## Rules

- An automatic action on someone's behalf must check whether they are in the middle of something.
- Automatic and chosen paths do not share a write. Anything automatic is temporary state.
- A failure event must carry enough to explain the failure, not only to count it.
- Two locks for anything that interrupts a viewer: the player refuses to ask, and Reely refuses to act on its own evidence.
