# The stream lookup waited for the tap

## What

Three loose ends after the continue-watching fix
([2026-10-16-continue-watching-sent-you-to-s01e01](2026-10-16-continue-watching-sent-you-to-s01e01.md)):

- **Real accounts, not just the probe.** The new queue was run read-only against
  the two production accounts with series history (D1 `sync_items`, SELECT
  only, real TMDB season shapes). Every show part-way through used to answer
  S1E1: MobLand S2E2, House of the Dragon S3E4, The Bear S5E1, Lioness S2E1,
  Walter Boys S3E3, Dating Naked S2E6, Sex Education S1E2. All now answer the
  episode last played. Shows only ever started at S1E1 used to answer E2 (a
  play counted as a finish); they now answer E1 until it is actually finished.
- **First play of a title cost a ~1.2s provider walk after the tap.** The relay
  caches a resolved title for an hour, but the first viewer paid the walk, and
  it only began after the tap, the iframe, the shell and the bundle.
  `warmReelyTicket` (hover/touch/focus on Play) now also fires the player's own
  `/api/stream/resolve` with the fresh ticket, `no-cors`, so the relay is
  walking (or done, and caching) before the player asks. The relay shares an
  in-flight walk, so the player's request joins it instead of starting another.
  Only the warm path does this: a ticket minted by the player's mount is
  followed by the player's own lookup straight away.
- **Embeds started from zero on any other device.** Positions sync through the
  account, but an embed keeps its own progress in its own storage on the device
  that played. A slot's `_QUERY` env can now carry `{start}`
  (`startAt={start}`), filled with the synced resume second and dropped when
  there is none. vidlink documents `startAt` for exactly this ("cross-device
  watch progress"; its saved local progress still wins on the device that has
  one). The start is latched per frame (`useFrameStart`), keyed on server +
  title/episode.

## Mistakes

- **Built a measurement harness before reading the docs.** Two headless runs to
  see whether embeds honour a start parameter: the first as `HeadlessChrome`
  (refused outright), the second with a real UA (messages flow, but no stream
  ever loads, `duration` 0). One fetch of the provider's own docs answered the
  question. Docs first, harness second.
- **The obvious wiring would have reloaded the embed every few seconds.** The
  frame URL is derived in render. Reading the position there live means every
  progress write from the bridge produces a new `src`, and React re-points the
  iframe. The latch reads once per frame identity; the real-page check wrote
  eight positions and the frame never moved.
- **No wrong turn on the pre-walk** beyond a first instinct to put it in
  `heldTicket`, which would have doubled the lookup on every cold mount.

## What worked

- Running the new and the PRE-FIX queue (`git show d3238de^:lib/nextup/progress.ts`)
  side by side on the same real rows: a before/after table nobody can argue with,
  and no account was touched.
- `pnpm resume:probe` grew the hover: it asserts the lookup for S2E3 goes out
  before the tap, and that the tap spends the hover's ticket instead of minting
  a second. 14/14.

## Rules

- A value that rides an iframe URL is read once per frame, never per render.
- Pre-work on intent belongs on the intent path only; the mount path already
  does the real thing a moment later.
- Before measuring whether a third party supports a parameter, read its docs.
- Verifying a data-shape fix: run old and new logic on the real rows, read-only.
