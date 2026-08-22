# 2026-08-22 — Real-time queue, positions that travel, and See-all on touch

## What

- `/api/next-up` now builds its queue from **every store that knows what you played** (`completed` + `history` + `resume`), so films and shows started at S01E01 appear — previously only ticked episodes counted.
- Playback positions (the self-hosted player's per-title seconds) **sync cross-device** as the long-dormant `resume` store: same mirror/diff/tombstone engine as everything else, on a 30s fuse instead of 2s, flushed the moment attention leaves the page. Films get a real progress bar from them (`filmPercent`).
- Pro liveness: `useLibrarySync` now pulls every 20s while the document is visible and immediately on visibility change; `lib/library-sync` emits `subscribeSyncSettled(ok)` after each attempt; new shared hook `hooks/use-next-up.ts` refetches the queue on settle / cross-tab store change / visible-again (throttled) / bfcache restore. No timers while hidden.
- Every rail heading got an always-visible `SeeAllLink` chip (`List` + `StaticRail` parity); home's queue row links to a new light `/next-up` page instead of the heavy account console.

## Mistakes

- **I nearly tombstoned undateable rows.** First version of `collectResumeChanges` skipped a position whose `updated_at` couldn't be parsed — which made it *absent*, and absent means deleted in this engine. A corrupt stamp would have wiped everyone else's copy. Fix: carry the mirror's stamp across for unreadable rows. The test suite caught it only because I wrote the test first as "should skip" and the assertion failed loudly.
- **Verified in the wrong runtime again.** Burned several browser-harness rounds trying to exercise the pro flow under `pnpm dev`, where no `/api/*` Worker route exists (2026-08-16 lesson says exactly this). The stub chain needed hint cookie + profile cache + `/api/auth/refresh` interception before the app even believed it was signed in.
- **Outbound payload shape drift:** array stores push WatchedItem *objects* (the server serialises); I first pre-stringified positions. Widened `OutboundChange.payload` instead of special-casing at the call site.

## What worked

- Reading `tests/next-up.test.ts` before touching the walk — the "first GAP, not highest+1" philosophy is pinned there, and seeding history into existing groups would have broken it silently.
- Making the resume diff/apply pure (`collectResumeChanges(map, previous, now)` / `applyResumeRows`) with thin IO wrappers — testable without localStorage, same pattern as `collectChanges`/`applyChanges`.
- DOM-level browser assertions (chip geometry, href, boundary text) survived where screenshots timed out.

## Rules

- **A row you cannot date is not a deletion.** In any mirror/diff sync, an unreadable local entry must inherit the mirror stamp, never fall out of `current`.
- **New synced data rides `SYNCED_STORES`/the resume adapter — never a second transport**, and pushes get their own debounce keyed off the changed storage key (positions are chatty; library edits are not).
- **Server queues should read payloads they already have**: film name/poster came free from `history`; adding TMDB calls for them would have spent subrequests re-buying data D1 holds.
- Touch has no hover: any affordance that only appears on hover is invisible to most of the audience. SSR twin components (`StaticRail`) must be updated in the same commit or the LazyRail swap jumps.
