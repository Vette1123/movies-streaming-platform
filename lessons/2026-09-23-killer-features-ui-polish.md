# Killer features: UI/UX polish

## What

A UI/UX pass over the five surfaces shipped on 2026-09-22.

- **Phone remote** (`together-remote.tsx`): a thin strip at the top of the page
  became a bottom sheet in the thumb zone. It has a large time readout, an
  80px play/pause and 56px skip buttons with the ↺10/↻10 glyphs, and pads for
  the safe area. `body[data-remote-open]` hides the install nudge and the tip
  jar, and pads the page so nothing sits under the sheet.
- **Tonight's triple**: a full-width grid of three posters became a band. The
  copy and Spin sit left, and the three tiles sit right at a step below the
  list's own size; they stack on phones. Each spin replays the `rise-in` entrance.
- **/compare**: the score is now the headline (a large percentage, a bar,
  both avatars via the existing `AccountAvatar`, and names linking to `/u/`).
  Section headings carry counts, "Only A" and "Only B" sit side by side from
  `md`, and the inputs draw an `@` prefix, which `handleFromInput` already
  tolerates when typed.
- **Copy**: no em dashes left in the visible strings of these surfaces
  (toasts, share text, the QR dialog, /watch-together, compare hints and
  empty states).

## Mistakes

- **Wrong tile measurement.** I sized the triple from a remembered "the grid
  below is ~155px". It is ~265px. The first cut made the band's tiles look
  like thumbnails beside the list they came from. Measuring in the browser
  caught it, and the tile column was widened at `lg`.
- **Keyed the live region.** The first cut keyed the `<ul aria-live>` on the
  seed to replay the animation. That remounts the live region, and a freshly
  inserted live region announces nothing. The key now lives on the `<li>`s,
  so the list stays mounted and each tile still re-enters.
- **Headings without spaces.** Flex `gap` made "23%" + "in common" and
  "In both shelves" + "3" look spaced, but `textContent`, and so the
  accessible name, read "23%in common". A `{' '}` between the flex children
  fixes the name without changing the layout.
- **A dead dev server looked like a code bug.** The dev server's render
  worker had crashed ("Jest worker encountered 2 child process exceptions"),
  and the detail page 500'd. It read like a regression until the dev log
  showed the crash. A restart fixed it.

## What worked

- Reusing `AccountAvatar` (picture or monogram, with sizes) instead of
  extracting the profile page's private `Avatar`: there was no new component,
  and one look across the account and compare surfaces.
- Mocking `fetch` in the page to drive /compare and the remote pad through
  real states (a score, counts, a 1:02:05 readout, optimistic Pause → Play,
  and Back 10 → 1:01:55) with no Worker running.

## Rules

- Measure the neighbour before sizing against it; never size from memory.
- Replay an entrance by keying the children, never the live region.
- Flex `gap` is not a space: add `{' '}` between inline children of a heading.
