# Watch Together was half-wired, and every half looked fine on its own

Date: 2026-08-24
Area: `components/watch-together-bar.tsx`, `lib/watch-together.ts`,
`components/details-hero.tsx`, `components/player/reely-player.tsx`,
reely-pro-player `client/main.ts`

## What

Four defects in the room, found by reading the two halves of the sync against
each other rather than by using it:

1. **Guests could not be steered on the default player.** The bar was handed
   the third-party embed's iframe ref, always — and the house player is the
   default source, with its own frame. `ReelyPlayer` now takes the ref the hero
   owns, and the bar is given whichever surface is on screen.
2. **A host on an embed sent no beats at all.** The bar only understood the
   house player's `reely-player` messages. It now also reads the embed envelope
   through `parseEmbedProgress`, the parser the progress bridge already uses.
3. **The player reported `playing: !art.playing`.** Inverted: a guest paused
   when the host played.
4. **A guest ignored a pause made in place, and obeyed a host who had left.**
   Zero drift, changed state, no action — the exact thing the feature exists to
   prevent. And a frozen "playing" beat from a closed tab dragged the guest
   backwards every four seconds forever. Both now live in `lib/watch-together.ts`
   as `followHost`, with tests.

## Mistakes

**Every one of these was invisible from inside its own half.** The host relay
works whichever surface plays, because those messages arrive on `window` — so
"host works" was true, and it hid that "guest works" was only true for a source
almost nobody uses. A feature with two ends needs to be read end to end; each
end passes its own review.

**"Prod-verified by curl" was recorded as verification of the feature.** The
tracker said the room round-trips — and it does: `POST /api/together/beat` then
`GET /api/together/state` returns exactly what went in. Not one of these four
bugs is on that path. Proving the transport proves the transport.

**The inverted flag survived because it is invisible while nothing changes.**
Position in the same beat is correct, so the room looks synced until somebody
pauses. A boolean that is only consulted at the moment of change is a boolean
nobody notices is backwards.

**The drift check was written as the whole rule.** "Pull them back if they are
more than three seconds out" reads complete, and silently encodes "state never
changes without the clock moving", which is false for exactly the pause case.

## What worked

- Pulling the guest's one decision out into a pure function. It is six tests
  and no mocking, and the stale-host case — which takes twenty seconds of a
  real film to reproduce — is one line of arithmetic in a test.
- Reusing `parseEmbedProgress` instead of writing a second envelope reader. The
  bar and the progress bridge now agree about what an embed's message means by
  construction.

## Rules

- A two-ended feature is verified end to end or not at all. One end's tests
  pass while the other end is not wired at all.
- A transport round-trip is not a feature test. Curl proves the row moves.
- Anything positioned by "how far apart are we" also needs "are we in the same
  state" — the state can change without the distance changing.
- A ref that identifies "the player" must follow whichever player is mounted,
  not the one that happened to exist when the code was written.

## Not verified here

Hosting from an embed could not be exercised locally: the embed never starts
under the harness, so it emits no `PLAYER_EVENT` to relay. The parser it goes
through is covered by `tests/embed-progress.test.ts`.

## Follow-up, same day: the guest half, actually driven

The guest was finally exercised for real — a browser tab in a room, a spy
wrapped around `HTMLIFrameElement.prototype.contentWindow` so every
`postMessage` into the player frame is recorded, and `curl` playing the part of
the host. That is what a two-ended feature needs and what the earlier
"prod-verified by curl" was not.

It found a fifth defect immediately. A guest whose player reports nothing back —
an embed always, the house player until its first tick — leaves `latest` null,
so `followHost` re-decided to follow the _same_ beat on every poll and re-seeked
the frame every four seconds. Two identical `{kind:'play',t:1200}` pushes in
consecutive cycles, forever. The fix is one ref: act on a beat once, keyed by
its `updated_at`. A playing host stamps a new one every 4s, so drift correction
is untouched; verified by sending a later `pause` beat and watching exactly one
new push arrive.

**Mistake:** the pure function got tests and the loop around it did not. The bug
is not in `followHost` — every one of its six tests is still right. It is in
"how often do I ask it, and what do I do when the answer has not changed",
which lives in the effect and was never looked at. Extracting the decision made
the decision testable and made the schedule invisible.

**Rule:** a poll loop needs an "act once per input" rule as much as it needs a
decision rule. A pure predicate that returns true every 4s is not a bug in the
predicate.
