# The ticket was on the critical path

**Date:** 2026-08-24
**Area:** Reely Player boot (`components/details-hero.tsx`, `components/player/reely-player.tsx`, `lib/pro/ticket-cache.ts`)

## What

Pressing play on a detail page started a cold chain: mint an entry ticket at
`/api/pro/ticket` (a Worker round trip), then load the player shell, then its
bundle, then resolve the stream. Only the first link can be paid for *before*
the tap, so it now is: hover, focus or touch on the play stack calls
`warmReelyTicket()`, and the player's mount reads the same cache instead of
minting its own.

The cache is keyed by `type:id:season:episode`, holds the promise (not the
resolved URL) so a warm-then-immediate-tap shares one request, and expires
after 45s — entry tickets live ~90s, so anything older would hand the visitor
a ticket that expires mid-boot and reads as "your session expired".

## Mistakes

- **Extracted the cache with a throwaway script that only did half the job.**
  The script deleted the block from `reely-player.tsx` and rewrote its import
  to `@/lib/pro/ticket-cache`, but the write of the extracted text went
  nowhere and the new module was never created. The tree stopped compiling and
  the block existed in no file at all. A single `node -e` that both removes and
  writes is one failed `writeFileSync` away from losing the code — check
  `git diff --stat` for the *matching* insert before trusting the delete.
- **Reached for the extraction to make it testable, not because the component
  wanted it.** That was still the right call (the cache is money-adjacent
  logic and browser verification needs a supporter session), but the reason
  was "I cannot verify this in a browser right now", which is worth saying out
  loud rather than dressing up as architecture.
- **`app/mood/page.tsx` was failing `pnpm lint` on `main`** and nobody noticed
  because the failing line is an error among 22 warnings, and `tail` of the
  output shows only the count. Read-the-URL-on-mount is a legitimate
  `set-state-in-effect` — hydration forbids doing it during render — and this
  repo already had the disable-with-a-reason convention in seven other files.
  Grep for an existing disable before inventing a workaround.

## What worked

- Keeping the promise in the map, not the URL: the warm request and the real
  one are the same request, so a fast tap costs nothing extra and never races.
- `void url.catch(() => tickets.delete(key))` — without it a single offline
  moment poisons the entry and every later play re-throws the same old error.
- `useIntentProps(warm)` factored out of `usePrefetchIntent`, so the play stack
  gets `onMouseEnter`/`onFocus`/`onTouchStart` from the same helper the cards
  use rather than a second hand-rolled set of intent listeners.
- Five unit tests that need no browser: reuse, expiry, per-episode keys,
  eviction after failure, and "the warm path never throws".

## Rules

1. Anything that can be fetched before the tap should be — but cache the
   *promise*, and expire it well inside the lifetime of what it holds.
2. A refactor script must prove the destination exists before it removes the
   source. `git diff --stat` with only deletions is a failed extraction.
3. `pnpm lint | tail` hides errors behind warnings. Check the error count.
