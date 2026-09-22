# The band was taller than the phone

Date: 2026-09-19
Area: `components/player/player-stage.tsx`, `styles/globals.css`

## What

Reported from a phone, with a screenshot: "when I rotate my phone it's fucked, I
can't see the player". Portrait was fine. In landscape the page rendered the
header, the server-switcher pill, and then a horizontal hairline where the film
should be.

`PlayerStage` is a column: a reserved band above the picture (`pt-20`, which is
what clears the 64px fixed header), the control row, the frame, and a reserved
band below (`pb-20`, which keeps the frame off the embed's own scrubber and the
install nudge). Both numbers are correct for a portrait phone, where the hero is
`100svh` and about 640px tall.

Rotated, `100svh` is about 200px. The two bands come to 160px of that before the
control row is measured at all, and the frame is a flex child with `min-h-0`,
so it is free to shrink: it was handed what was left, clamped at zero, and
painted as a line.

Measured in the browser against a 196px stage:

|        | padding     | frame height                                  |
| ------ | ----------- | --------------------------------------------- |
| before | 80px + 80px | **36px** (0 once the switcher row is present) |
| after  | 0 + 0       | **196px**                                     |

Shipped: two media tiers in `globals.css`, next to the `body[data-player-open]`
rule that already existed for the install nudge. Below 600px of landscape height
the bands go to zero and the control row leaves the flex flow to float over the
top edge, so the frame takes the whole stage. Below 430px — the line the
player's own chrome already switches at, in reely-pro-player's `play.html` — the
fixed site header and the tip-jar button hide for the duration of playback.

## Mistakes

**The reasoning in the comments was right and still produced the bug.** Both
bands have a paragraph above them explaining what they clear, and both
paragraphs are accurate. Neither asks what happens when the viewport is smaller
than the thing being cleared. A reserved band is a subtraction, and no comment
in the file stated the minuend.

**Rotation was never in the test matrix.** Every note in this file argues about
width — chips wider than the film, the picker sized to its provider list, the
sidebar at 360px. The one axis nobody varied is the one that broke, and it is
the axis a phone changes by being held differently.

**The first instinct was to make the band smaller.** A proportional band
(`min(5rem, 12svh)`) would have kept the frame non-zero and still shipped a
player squeezed into a third of a screen somebody had just rotated to make
bigger. Rotating a phone during playback is a request, not an accident; the
answer is no band, not a thinner one.

**The window would not resize, and that nearly stopped the verification.**
`resize_window` reported success and `innerHeight` stayed 1215 — the window was
maximized. Setting the hero's own height to 196px puts the stage in exactly the
collapsed state without a small window at all, and rewriting the authored
rules' `media.mediaText` through the CSSOM proves the cascade wins with no
inline styles in play. Both numbers above came out of that, not out of reading
the CSS.

**600px was nearly a guess.** It is not: `components/header/hero-slide.tsx`
already clamps the hero overview at `[@media(max-height:600px)]:line-clamp-1`.
The breakpoint was in the codebase before this bug was, and it turned up in a
PostHog `elements_chain` while looking at something else.

## What worked

- Measuring the frame's `getBoundingClientRect().height` before and after, on
  the real page, rather than trusting the arithmetic. 36px is not a number
  anybody would have predicted; the prediction was 0.
- Reading `document.styleSheets` back for the authored `@media` blocks. It
  confirms the conditions parsed and the declarations landed on the selectors
  meant, which a screenshot cannot show.
- Hanging the rules off `.player-stage` / `.player-stage-controls` hooks rather
  than Tailwind arbitrary variants. The same tier has to reach `.site-header`
  and `#bmc-wbtn`, which are not in the component, so one block in one file
  holds the whole behaviour and one comment explains it.

## Rules

- A reserved band must be compared against the smallest viewport that can
  contain it. `pt-20` is 80px on a 640px hero and 80px on a 200px one.
- Test rotation. Portrait and landscape are different viewports on the same
  device, and a phone changes between them without navigating.
- When a viewport gets short enough that chrome and content compete, chrome
  loses. Rotating during playback means "make the picture bigger".
- Verify a media query by flipping its `media.mediaText` through the CSSOM and
  measuring the result. A window that will not resize is not a reason to
  verify by reading the source.
- Before inventing a breakpoint, grep for one. This codebase already had 600px.
