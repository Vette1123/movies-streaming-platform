# The search list scrolled to the row that was highlighted before

## What

On a phone, searching left the results list parked among the shortcuts, and a
swipe for the results did nothing. Cause, measured with a CDP probe that logged
every `scrollIntoView`: cmdk re-selects "the first item" on each keystroke and
then scrolls the row that is **still highlighted in the DOM** (its scroll runs
before the `aria-selected` update), and search is async, so that row is a
shortcut a finger rested on (touch-move selects). Results then landed above it,
scroll anchoring held the shortcut in place, and with the keyboard up (a ~312px
list) the list sat 181–2092px down. Enter opened the shortcut, not the first
result. Fix: `components/command-menu.tsx` controls cmdk's `value` — cleared on
each keystroke, set to the first result whenever a new result set renders, list
reset to the top. `pnpm search:probe` pins it.

## Mistakes

- Drove desktop wheel scroll in dev and prod first: both worked (0 → 500px), and
  so did a touch drag on a full-height phone. The bug needs three things at once
  — short viewport, a prior highlight on a shortcut, async results — and no
  single-variable test had all three.
- Read cmdk's minified source as "selects the first item, scrolls it into view"
  and built the first fix on that: made the loading skeleton a cmdk item so the
  first item would sit at the top. The probe stayed red. cmdk scrolls the
  PREVIOUSLY highlighted row, and the selection was lost when the placeholder
  unmounted. Reverted.
- TaskStop killed `pnpm dev` but not its Next child, so the old checkout kept
  :3000 and the worktree server came up on :3001. One "still red with the fix"
  run was hitting the unfixed server. Read the dev log's port line.
- The first probe tapped the shortcut to highlight it, which opened Home and
  closed the palette. A finger _on_ a list is a drag, not a tap.
- The first committed version cleared the highlight whenever a result set was
  empty, so "No results" and "Search didn't answer" had no active row and Enter
  did nothing. The probe could not see it (it only searches for hits). Caught in
  the edge-flow pass before the push. Now it only takes over the highlight when
  there is a first result.

## What worked

- A throwaway Node CDP harness (built-in WebSocket, headless Chrome, touch
  emulation, `Fetch.fulfillRequest` for `/api/search`) gave numbers the Chrome
  extension could not: it has no mobile viewport and no touch.
- Wrapping `Element.prototype.scrollIntoView` to log which row got scrolled and
  when: that one log disproved the first fix.
- Red on the unfixed server and green on the fixed one, with the same probe.

## Rules

- cmdk with `shouldFilter={false}` and async results: control `value`. Its
  automatic first-item selection runs at keystroke time, before the results
  exist.
- To reproduce a scroll bug on a phone, test the keyboard-up height (~420px
  viewport) with real state (recent searches, a touched row), not an empty
  full-height page.
