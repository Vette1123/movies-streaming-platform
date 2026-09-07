# 2026-09-07 — An empty box is still a box

## What

Nothing on a detail page was clickable in production. Not the play button, not
Play trailer, Add to list, Rate it, Watched or Share. Reported from a phone;
it was every viewport, including a 2560px desktop.

Yesterday's control-bar work replaced the hero's `<iframe className="size-full
py-20 hidden">` with `PlayerStage`, a flex column that reserves a band for the
chips and gives the rest to the picture. The stage renders whether or not
anything is playing — it has to, because keeping the frame mounted is what
stops pressing play on the already-playing episode from restarting it. Inside
the hero those two things are siblings in one centred box:

```
div.flex.h-full.items-center.justify-center
  ├─ motion.div.absolute.inset-0   ← the button stack
  └─ div.relative.size-full…       ← PlayerStage
```

Both are positioned, neither sets a `z-index`, so DOM order decides, and the
stage is second. The old markup got away with it for one reason that was never
written down: the only element there was `display: none`, so it was not painted
and not hit-tested. The wrapper that replaced it was neither hidden nor empty of
layout — a full-size transparent box sitting on every control in the hero.

`document.elementFromPoint` at each button's centre named it in one call:

| button            | receives the tap                                |
| ----------------- | ----------------------------------------------- |
| Watch The Odyssey | `div.relative.min-h-0.flex-1 < div…pb-20.pt-20` |
| Watch trailer     | same                                            |
| Save to watchlist | same                                            |

The fix restores the property the old code had by accident, deliberately this
time: `PlayerStage` takes `active`, and an inactive stage is `display: none`.
`showSpinner` folded into it — both call sites were passing the same boolean,
and a spinner gate that can disagree with a display gate is the next version of
this bug.

Nafis reached the App Store yesterday, so it got its id (`6807595780`) and, with
it, the chooser link every other app already had.

## Mistakes

- **The rule was already in the ledger and I did not apply it.**
  `2026-08-16-backup-stream-servers.md` ends with "Visible is not clickable —
  hit-test every overlay with `elementFromPoint`; the bottom of a video is the
  most contested space on the page." The chips change added an overlay to that
  exact area and shipped without one hit test.
- **Verified the state the change was about, and only that one.** The chips were
  measured against the playing stage — width, overhang, the band above the
  picture — which is the state a visitor sees after they press play. The state
  that is on screen 100% of the time BEFORE they press it was never opened.
- **Nearly went looking for a mobile-only cause.** "On mobile I can't click
  anything" reads as a breakpoint bug, and there were two fresh candidates from
  the same evening: a hero synopsis that became a `block` link, and a season
  list that dims with `pointer-events-none`. Both were innocent. Reproducing on
  the desktop that was already open took one probe and cost nothing.
- **`pnpm lint` had been failing outright, so it had not checked anything.** An
  agent worktree left inside `.claude/worktrees/` is a second checkout of this
  repo; the Tailwind ESLint plugin walked into its `.next/` looking for a
  stylesheet that was never generated and killed the whole run with ENOENT. A
  linter that exits 2 and a linter that finds nothing look identical in a
  scrollback. Ignored the path.
- **Trusted a screenshot over the DOM for one round.** The harness tab renders
  at about 1Hz, so the hero photographs blank on production and on dev alike.
  Read as "the page is broken", it sent me looking for a second fault that did
  not exist while the DOM had the buttons all along.

## What worked

- **Probing production first.** The bug was reported against the live site, so
  the first `elementFromPoint` sweep ran there — which proved in one call that
  it was not a phone, not a browser, and not the deploy: a 2560px Chrome on this
  machine was equally dead.
- **Naming the covering element's ancestor chain, not just the element.**
  `div.relative.min-h-0.flex-1 < div…pb-20.pt-20 < div.flex.h-full…` is the file
  and the commit, without opening either.
- **One prop for one fact.** `active` means "this surface is on screen"; the
  spinner and the display both read it. Two booleans that must agree is the
  shape this bug came in.
- **Re-probing every surface the same evening touched.** Home and TV detail
  came back clean, and the TV probe's "blocked" chips turned out to be the
  server switcher inside the now-hidden stage — the fix reporting itself.

## Rules

- **A component that stays mounted while its surface is off screen must be
  `display: none`, not merely empty.** Emptiness is not inertness: a sized,
  positioned box with no children still paints and still takes the tap.
- **Hit-test the state BEFORE the interaction, not only the one the change is
  about.** The pre-play hero is on screen for every visitor on every page; the
  playing hero is on screen for the ones who got that far.
- **"It's broken on mobile" is where they noticed it, not where it lives.**
  Reproduce on the machine already open before reaching for a breakpoint.
- **A linter that errors is not a linter that passes.** Read its exit code, and
  keep second checkouts of the repo out of its walk.
- **Never layer two Tailwind display utilities and hope.** `flex` plus a
  conditional `hidden` is resolved by emission order in the generated CSS, not
  by the order they appear in the class string; pick one with a ternary.
