# Handoff — chip/poster/button redesign + app-wide DRY

**Date:** 2026-07-24 · **Branch:** `main` · **State:** uncommitted working-tree, typecheck clean, verified in browser. **NOT committed.**

## Status: DRY list COMPLETE + border-fix pass COMPLETE

All low-risk AND structural DRY items done. Three user-flagged border complaints fixed. Everything typecheck-clean and browser-verified on a fresh dev server (service worker unregistered — see Gotcha).

## How to resume
1. `pnpm dev`. If UI looks stale, it's the **PWA service worker**, not HMR — unregister it (DevTools → Application → Service Workers → Unregister) + clear caches, or hard-reload. This bit us: a stale SW chunk made a shipped fix look un-applied for 20 min.
2. Testing = browser-harness skill only (Chrome DevTools MCP disabled).
3. Next step is almost certainly: **commit** (see Commit note) — nothing left on the DRY list.

## DONE this session — structural DRY (all verified)
1. **`buildWatchedItem(media, extra?)`** in `hooks/use-local-storage.ts` — replaces 3 near-identical WatchedItem builders in `use-watchlist`, `use-watched-media`, `use-completed-media`.
2. **`components/loaders/grid-skeleton-cells.tsx`** (`<GridSkeletonCells count>`) — the load-more skeleton cells, reused in `media-content.tsx` + `filtered-media-content.tsx`.
3. **Card "Watched" medallion** → `chipVariants({ variant: 'success' })` + shape override, in `card.tsx`.
4. **`mobile-nav.tsx`** — 5 social `<Link>`s → data-driven `SOCIAL_LINKS[]` + one template.
5. **`components/media/details-extra-info-layout.tsx`** (NEW) — shared body; movie + series `details-extra-info.tsx` are now thin wrappers passing title/date/genres/heroRates/extraInfo.
6. **`components/media/filter-controls.tsx`** (NEW) — `CountBadge` (solid/soft tones) + `FilterTriggerButton`. Used by `filter-dialog`, `filter-sheet`, and sidebar section badges.
7. **`filterToggleVariants` cva + `genreToggleState` helper** in `filter-sidebar.tsx` — the 3 hand-copied toggle class-strings (genre tri-state / decade / cert) now one cva (`shape: pill|square`, `state: idle|active|excluded`). Tri-state verified: primary → destructive+line-through → slate.
8. **`components/watch-history/watched-items-grid.tsx`** (NEW `<WatchedItemsGrid>`) — shared shell (skeleton + empty state + sorted grid + optional toolbar). `watchlist.tsx` and `watch-history.tsx` are now thin config wrappers (sortBy `added_at` vs `modified_at`, empty copy, DeleteHistoryAlert toolbar).
9. **`lib/media-page.ts`** (NEW) — `MEDIA_LIST_CONFIG`s + `mediaListMetadata()` factory + `buildMediaStaticParams(fetchers)` + `buildDetailsOgImages()`. **`components/media/media-list-page.tsx`** (NEW `<MediaListPage>`) renders the browse-list body. Both `/movies` + `/tv-shows` list pages and both detail pages now delegate (generateStaticParams + OG images shared).

## DONE this session — border fixes (user-flagged, verified)
- **Hero action buttons** (`components/ui/hero-action-button.ts`): removed the hard 1px border (`border`, `border-white/35`, hover borders) → borderless glass (fill + inset top-highlight + hover shadow). Saved/Watched tints bumped a touch so toggle state still reads.
- **Details posters** (`components/media/details-content.tsx` + `series/`): dropped `ring-1 ring-foreground/15 ring-inset`; kept `overflow-hidden rounded-xl shadow-xl`.
- **Hero card black corners** (`components/header/hero-slide.tsx`): the `intro` branch of `BlurredImage` renders a square `bg-slate-900` backing sibling; the `min-h-[700px] w-[400px]` wrapper wasn't clipped so it leaked past the rounded image corners = "black border". Fix: wrapper now `overflow-hidden rounded-xl shadow-2xl`; image reduced to `pointer-events-none size-full object-fill lg:object-cover` (ring + rounded moved to/handled by wrapper).

## Earlier (prior session, also uncommitted) — chips/poster/hero-button/media-type DRY
chip.tsx visible surfaces + fancy hover; `genre-link.tsx`; `toAnalyticsMediaType`. (Unchanged this session.)

## Verified in browser (fresh server, SW cleared)
Movie details (extra-info layout, borderless buttons, ringless poster), homepage hero card (rounded/crisp, no black), /movies filter sidebar + tri-state genre toggle, /watchlist empty state.

## Remaining DRY: NONE. Already-well-factored (do NOT touch): score-chip, empty-state, use-local-storage store, details-hero wrappers.

## Commit note
Repo rule: subject starts with type (`feat`/`fix`/`refactor`), no `@` prefix, **no** Claude co-author trailer. Suggest splitting: `refactor: collapse movies/tv + watchlist/history + filter duplication into shared primitives` and `fix(ui): borderless hero buttons + clip hero/detail poster corners`.
