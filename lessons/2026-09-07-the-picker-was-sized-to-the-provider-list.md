# 2026-09-07 — The picker was sized to the provider list

## What

A supporter on a phone reported the server picker "bad and cut". The screenshot
showed the bar holding a 40px sliver of magenta at its left edge, then three
grey pills. The sliver was the house player — the surface they pay for — and
the pill they were actually watching was off-screen entirely.

Measured on the 412px phone in the report: the rail's content was ~358px inside
a ~281px box, so 77px overflowed, all of it off the left. On the dev box with
this deployment's env there are **six** sources, not four, so the rail was
never going to fit at any phone width.

The bar was rebuilt as ONE control: a pill that names what is playing, opening
a popover with the list. `components/player/source-switcher.tsx` loses
`useOverflows`, the edge mask, the scroll-into-view effect and the snap rail;
`PopoverRow` gains a `pressed` prop so a single-choice list marks its choice
the same way everywhere. Settings, the pill next door in the same bar, has been
a trigger-plus-popover all along — the two halves of the player's chrome now
work one way instead of two.

## Mistakes

- **Fixed the same bug three times without fixing its cause.** `flex-wrap`
  became a scroll rail became a scroll rail with a mask and an auto-scroll.
  Every version sized a fixed-width bar to a list whose length comes from the
  environment. The cause is the sizing, not the overflow strategy: a control
  whose width is `f(number of providers)` has no correct behaviour on a phone.
- **Wrote the auto-scroll that hid the thing it was there to reveal.** The
  effect scrolls the CURRENT entry into view. On a rail that starts at the
  house player and is scrolled to a later entry, "current is visible" and
  "the premium surface is a sliver" are both true at once, and only one of them
  was being checked.
- **Nearly rebuilt the row rather than replacing it.** The first instinct was
  scroll-padding plus a better `scrollIntoView` call. That is polish on a
  control that cannot fit six labels in 281px.
- **Shipped a `trailing` prop on the shared row and then had no caller.** A PRO
  badge inside the list was a fifth signal on a row that already had a distinct
  icon, name, subtitle and its own heading. Removed the badge, removed the prop.
- **Painted the PRO badge in the same gradient as the pill behind it.** Visible
  only in a screenshot: two gradients stacked read as one smudge. It is a
  `bg-black/35` cut-out, which is what it always was on the old chip.

## What worked

- **A same-origin iframe as a phone rig.** `resize_window` does nothing to a
  maximised window in this harness, so a 390x844 iframe pointed at the route
  under test gave a real mobile layout, real `100svh`, and same-origin DOM
  access for measuring. `getBoundingClientRect` on both the bar and the picture
  answered every layout question that a screenshot could not.
- **Screenshot coordinates need no scaling for `left_click`.** The 2026-08-31
  lesson says to scale from the 1568px screenshot to the 2560px window; that is
  no longer true, and unscaled coordinates hit their targets first try.
  Synthetic pointer/mouse events dispatched from injected JS were the ones that
  silently did nothing.
- **Counting the sources before designing.** Six configured slots, not the four
  in the report, is what settled rail-versus-menu in one step.

## Rules

- **A control's width must not be a function of how much data it holds.** If
  adding a row can change the bar's size, the bar is wrong; move the rows into
  a surface that opens.
- **A scrolling rail hides something by definition.** Only reach for one when
  what it hides is genuinely equivalent to what it shows. Server 1 and the
  house player are not equivalent.
- **When two controls sit in one bar, they get one interaction model.** The
  broken one adopts the working one's path.
