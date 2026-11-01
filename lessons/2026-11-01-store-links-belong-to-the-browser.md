# Store links belong to the browser

## What

A Mac visitor reported that the Masareef and Rafiq cross-promo opened nothing. Every store
anchor cancelled its own click and called `window.open`. On a desktop the browser now
follows the href to `/go`; only a phone intercepts, to reach its store app. A button has no
href, so a blocked `window.open` falls back to this tab.

## Mistakes

- The dead click never reproduced. Playwright WebKit with a Mac user agent opened `/go` on
  every link, and it has no Safari popup blocker or content blockers. The fix removes the
  fragile path; it is not a proven diagnosis of that visitor's Mac.
- `'noopener'` in the `window.open` features made it return null on success, so the code
  could never have noticed a blocked popup.
- A first probe "reproduced" a miss with the card 3,300px off-screen. Hit-test the element
  under the pointer before believing a failed click.

## What worked

Reading the public `/go` page first ruled it out in one fetch. Clicking every live anchor in
a real engine separated the page from the click path.

## Rules

- A real anchor keeps its own navigation unless a device needs something else.
- Never pass `noopener` to `window.open` if the return value matters.
