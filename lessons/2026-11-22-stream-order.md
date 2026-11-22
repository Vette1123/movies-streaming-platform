# Stream order: solid servers first, failing ones last

Providers are named by their old slot (S1..S5), since the hosts live only in secrets.

## What

- **Picker order is now set by measured play rate.** The new order is S1 (default), S5 (stall rescue), S4, S2, S3. `pnpm stream:order 1 5 4 2 3 --push` moves every var of a slot together and mirrors the result to the GitHub secrets. `pnpm stream:chain` passed afterwards.
- **Slots 1-3 now read `_MOVIE_PATH`/`_TV_PATH` like slots 4-5.** Before, a provider with its own URL shape could never sit above slot 4. `tests/stream-slot-env-mapped.test.ts` fails when `config/sources.ts` reads a var that deploy.yml does not map.
- **S4 always played S01E01.** Its TV path was `/embedtv/{id}?s={s}&e={e}`, but it only honours `/embedtv/{id}&s={s}&e={e}`. Checked live on an S2E1.
- **`silent` waits 45 s and only counts while the tab is visible** (`silentIsFailure` in `lib/player-hop.ts`). The "try another server" offer still appears at 9 s.
- **`posthog:usage` and the dashboard count server faults only.** They leave out silent frames and titles with no stream yet. The failure rate is taken over attempts: S2 read "325%" before this change.
- **The latched `activation` area and the `health` area no longer trip "reach fell".**
- **The iOS install hint's tile is a neutral picture of Safari's Share glyph** instead of a cyan button lookalike. Three iPhone visitors had tapped it and nothing happened.

## Mistakes

- **I first reported the default failing 18-24%.** That was a measurement artifact. `silent` (commit 03aad4a) fired at 9 s on working embeds that were waiting for their own play button. The real fault rate is 7% (355 plays, 27 faults in 14 days), and it is the most-used server by far.
- **The stall rescue landed on S2, which fails 76% of the time** (37 auto-hops). Ordering by when a provider was added put a dead server in the one place meant to save a viewer.
- **The first draft of `stream:order` dropped the first number when `--env` was absent**, because `indexOf` -1 + 1 is 0. Extracting the pure module and testing it caught that before it ran.
- **"Activation fell 12% → 6%" was not a real drop.** `first_play` latches once per browser, so its reach shrinks with the new-browser pool. The new-visitor play rate held at 25%.
- **Rage clicks on `/` were 5 in 28 days.** Only the iOS tile pattern was real.

## What worked

- **A local grid page that frames all five slots side by side** on three titles: an old movie, a new release and a TV episode. It showed in one screenshot what PostHog could only hint at:
  - S2 black or "not found"
  - S3 stuck on its own human check
  - S5 clean on all three
- **Zooming on the episode label inside the frame** is how the S4 bug showed up. Every episode "played", just the wrong one.

## Rules

- **Re-rank servers from `posthog:usage` faults, not raw `player_failed`.**
- **Slot 2 is the rescue.** Put the second-best measured server there, never whatever was added last.
- **Reorder with `pnpm stream:order ... --push`, never by hand-editing secrets.** A label or path left on a slot attaches itself to the next provider.
- **Check a TV path against an episode other than S1E1.**
