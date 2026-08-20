# Five supporter features, and the cheapest place to put each one

**Date:** 2026-08-20

## What

Shipped the five pro-only features that came out of the "what else is worth
gating" question, plus icon cache-busting and the `/support` redesign that
preceded them in the same session.

1. **Hours watched, measured.** `buildWatchedItem` now captures the real runtime
   at mark-time; `computeStats` prefers it over the 42/115-minute averages and
   reports what share is exact. `/api/stats/runtimes` backfills the pre-existing
   library from `watched_media.runtime` with **zero TMDB traffic**.
2. **Not interested.** A new `hidden` sync store, a dismiss control on every
   For You tile, filtering in the browse grid, and an account panel to undo it.
3. **Spoiler-free episode titles.** A `prefs.spoilerFree` flag; unwatched
   episodes read as "Episode 4" with a per-episode reveal.
4. **Saved filter presets.** Named browse queries in `users.prefs`, surfaced at
   the top of the filter sidebar.
5. **"Now streaming" alerts.** The hourly sweep gained
   `append_to_response=watch/providers`, migration `0004` gained two columns, and
   a region picker landed in the alerts panel.

## Mistakes

**Four of the five were nearly built on their own infrastructure.** The first
plan for "not interested" was a table, for presets a table and an endpoint, for
hours-watched a TMDB lookup per title. Every one of those was wrong, and reading
the existing code rather than designing from the feature name is what caught it:

- `lib/foryou/routes.ts` builds its exclusion set from **every key in every sync
  store**, so adding `hidden` to `SYNC_STORES` excluded hidden titles from
  recommendations with _zero_ lines changed there. The plan had a filter step in
  it that did not need to exist.
- `users.prefs` is already an account-scoped JSON blob written by one endpoint
  every settings panel already calls. Presets are a name and a query string.
  The table, the endpoint, the client cache and the second sync path were all
  imagined work.
- The sweep already fetches a TMDB payload per watchlisted title every tick.
  `append_to_response=watch/providers` makes the whole streaming-alert feature
  cost **zero** extra subrequests. Fetching providers separately would have been
  one subrequest per title against a 50-per-invocation cap — the exact shape of
  the bug that has IMDb ratings switched off to this day.

**The sync engine was assumed generic and is not.** `lib/library-sync.ts` keys
every row by `type:id` and treats payloads as `WatchedItem`. `hidden` fits that
perfectly; `presets` does not, and would have had to pretend to be a title.
Noticing that is what moved presets to `prefs` — but the first design had them
in `sync_items` and would have shipped a preset masquerading as a movie.

**"First sighting" was the storm waiting to happen.** The obvious
implementation of a provider diff treats "we have no record" as "everything is
new". Shipping that would have notified every supporter about every title on
every watchlist, once, on the first sweep after deploy. `newProviders` records a
first sighting silently and only announces a change from a _known_ state. There
is a test named for exactly this, because the bug is invisible until it is
catastrophic and unrepeatable.

**A `<button>` was very nearly nested inside a `<button>`.** The spoiler reveal
control lives inside the episode row, which is itself a button that starts
playback. Browsers resolve that by un-nesting, which would have moved the reveal
control outside the row entirely. It is a `<span>` with a click handler and
`aria-hidden`, and the keyboard path is the row itself.

**`buildWatchedItem` took two concrete TMDB detail types.** "Not interested" is
triggered from a grid tile, which has never held one. The first version cast
with `as any` and an eslint-disable, which is the same risk with the checker
switched off. Replaced with `WatchedSource`, the structural minimum, which both
detail payloads satisfy — and which removed the two casts that were already in
that function.

**Heredocs kept truncating.** Three separate `cat > file <<'EOF'` writes over
~150 lines died with `unexpected EOF while looking for matching '`, silently
leaving the old file in place the first time. Wasted a cycle before switching
large writes to the Write tool. Check `wc -l` after a large heredoc, or do not
use one.

## What worked

- Reading `readLibrary`, `SYNC_STORES`, `normalisePrefs` and the sweep's tick
  loop **before** designing anything. Four features collapsed into existing
  machinery as a direct result.
- Pure modules for every decision that can misfire at scale
  (`lib/push/providers.ts`, `lib/filter-presets.ts`, the runtime arithmetic in
  `lib/stats.ts`), with 25 tests over them. The notification-storm case, the
  double-counting case and the prefs-column-growth case are all covered.
- Keeping the estimate honest instead of deleting it. `isExact` / `hoursLabel`
  mean the word "about" disappears when the number stops being a guess and comes
  back for a library that still has old rows in it.

## Rules

- Before adding a table, an endpoint or a store, read what the adjacent feature
  already uses. In this codebase: per-title data is a `SYNC_STORES` entry,
  account-scoped settings are `users.prefs`, and anything the sweep can learn
  from a payload it already fetches is free.
- `append_to_response` is the only way to add TMDB data to the sweep. A separate
  call per title is the 50-subrequest bug, every time.
- Any notify-on-change feature needs an explicit silent first sighting, and a
  test named after the storm it prevents.
- A control inside a row that is already a `<button>` cannot be a `<button>`.
- Large file writes go through the Write tool, not a heredoc.

## Addendum — what the browser found (same day)

The unit tests were green and the features were correct; three defects only a
real browser surfaced, all of them in the part no test covers:

- The `/support` flagship grid left a ~600px void in the right column at `lg`.
  Fixed with an explicit `lg:grid-rows-2` / `lg:row-span-2` and a
  `flex flex-col justify-center` on the short tile — an implicit grid was
  sizing rows off the tall card alone.
- Two feature cards shipped with near-identical titles ("Told the day it lands
  on something you already pay for" vs. the new-episode alert). Reading the
  list in a browser is what made the collision obvious; reading the config file
  never did.
- `/stats` said "1 titles". A plural bug in `stats-panel.tsx`.

Verification needed a signed-in **pro** browser against a dev server that
serves no `/api/*` at all. A `Page.addScriptToEvaluateOnNewDocument` fetch stub
covering `/api/auth/refresh`, `/api/account`, `/api/for-you`,
`/api/season-details`, `/api/filter` and `/api/stats/runtimes` did it. Two
traps worth remembering:

- The stub must return `prefs` as a **JSON string**, because `parsePrefs`
  reads the raw D1 TEXT column. Returning an object silently drops every
  preference, which reads exactly like a product bug.
- CDP's `addScriptToEvaluateOnNewDocument` binds to **one target**, and
  `new_tab()` creates a new one. Add the script after `new_tab`, then navigate
  with an in-page `location.href` assignment.

Also: filter state URL keys are the nuqs parser names (`selectedGenres`,
`sortBy`), not TMDB's (`sort_by`). A hand-typed `?sort_by=` URL leaves
`hasActiveFilters` false and the save control disabled, which looks like a
broken feature and is not.
