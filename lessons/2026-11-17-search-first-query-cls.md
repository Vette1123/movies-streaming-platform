# The first search still shifted 0.247

## What

After the chip-row fix, `pnpm cls:probe` still logged 0.2474 on typing "dune", all on the first
keystroke. The moved node was the Shortcuts group (`208->0 h207->0`): the idle hint above it (about
100px) is replaced by the loading skeleton (about 230px), which pushes the visible shortcuts down and
out of the phone viewport. The group stays 560px tall the whole time; only its visible slice moved.

Fix: `shortcutsVisible(status)` (lib/search-shortcuts.ts) renders the Shortcuts group, and its
separators, only in the idle state. A group that is removed does not shift; nothing else stays on
screen under the swap. Typing: 0.2474 -> 0.0000.

## Mistakes

- Read `h207->0` as the group being hidden (cmdk `hidden`, shouldFilter) and went through cmdk's
  source. A runtime dump showed it never hidden and always 560px tall: the 0 was the visible
  intersection leaving the viewport, so the cause was the group above growing.

## What worked

- A temporary per-keystroke dump of each group's `hidden` and height, which separated "hidden" from
  "pushed off screen" in one run.

## Rules

- A layout-shift source rect of height 0 can mean "moved out of view", not "removed". Measure the
  element before reading cmdk or React source.
- When a panel swaps a short state for a tall one, the content below it either gets the tall state's
  space reserved or is removed with the swap. Never left to be pushed.
