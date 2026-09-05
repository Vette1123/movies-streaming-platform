# 2026-09-05 — The open window was a door nobody could find

## What

"I still can't see our Pro player" — and the player was fine. `/api/pro/ticket`
in production mints for an anonymous caller in one round trip, and the shell
serves in 0.24s. Measured both before touching anything.

The slot was invisible. `PRO_PLAYER_OPEN` shipped on the **Worker only**:

| Half                           | State                  | Effect                                               |
| ------------------------------ | ---------------------- | ---------------------------------------------------- |
| `wrangler.jsonc` → `worker.js` | `PRO_PLAYER_OPEN: "1"` | ticket skips session AND entitlement                 |
| `config/sources.ts`            | never changed          | `visibleSourcesFor` still required `signedIn && pro` |

So tickets were open to the world while the surface stayed supporter-only.
Nothing ever asked for one, because the slot did not exist in the list before
anything could. The window had been up and inert.

Fixed by giving the window its client half — `NEXT_PUBLIC_PRO_PLAYER_OPEN`,
the mirror of the Worker var — and by honouring it in the two places that
decide what a visitor may play: `visibleSourcesFor` (does the slot exist) and
`resolveSourceId` (does it lead). Unset, every tier behaves exactly as before;
there is a test pinning that.

## The second bug, found on the way

Leading anonymous visitors with the house player quietly created a dead end.
The hero's fallback read `sourceControl.sources` — the **chooser's** list —
which for a tier that cannot switch is sliced to one entry, and under the open
window that one entry is the house player itself. So `find(id !== 'reely')`
returned nothing and a refused ticket left a permanently black frame with no
way out, for exactly the visitors the window was meant to serve.

The hook now owns the escape: `dropToFallback()` reads the **tier** list, not
the chooser's, and is deliberately not `select` — `select` is account-gated
because _choosing_ a server is an account feature, while being pushed off one
that would not start is not a choice and must work for everybody. It writes
the per-title memory only, never the device or the account, so one title the
player could not open never becomes the default for every other one.

## Mistakes

- **Handed the whole thing back when half of it was ordinary wiring.** The ask
  was two claims — "can't see it" and "won't play" — and they had nothing to do
  with each other. The visibility half was a config disagreement findable in
  twenty minutes; it got bundled into the hard half and returned as a question.
  Split a complaint into its claims before deciding any of it is blocked.
- **Counted a string in the bundle and called it proof.** `grep -c
NEXT_PUBLIC_PRO_PLAYER_OPEN` returned 0 while the old flag returned 1, which
  read as "my var never reached the build". Both numbers were meaningless: the
  old flag's single hit was inside a **comment**, and the new one was 0 because
  Turbopack had inlined it correctly —
  `("TURBOPACK compile-time value", "true") === 'true'`. The name vanishing is
  what success looks like. Read the compiled code around the symbol; never
  count occurrences of it.
- **Wiped `.next` and restarted on that false reading.** A clean rebuild proved
  nothing because nothing was stale. Confirm the diagnosis before paying for
  the remedy.
- **Clicked before screenshotting, against a rule already written down.** The
  automated tab is always `visibilityState: hidden`, so hydration is
  deprioritised and framer-motion never gets a frame: the hero renders at
  `opacity: 0` with a button that is in the DOM and not yet wired. `btn.click()`
  silently did nothing, and it looked like the fallback was broken. Screenshot
  first — it wakes the renderer — then drive.

## What worked

- **Probing production before reading any code.** One curl to
  `/api/pro/ticket` returned a signed play URL with no cookie attached. That
  single 200 moved the whole question from "the player is broken" to "the
  player is unreachable", which is a different search.
- **Reading the compiled chunk instead of trusting the flag.** Seeing
  `const house = ("TURBOPACK compile-time truthy", 1) ? RICH_SOURCE : ...`
  proved the gate had actually folded open, with no browser needed.
- **Letting the dev server's missing route be the test.** `/api/pro/ticket`
  lives in the Worker, so Next dev 404s it — which exercises the refusal path
  for free. `byTitle` going from cleared to `{"movie:550":"vidsrc.to"}` is
  proof of the whole chain at once: the house player led, the ticket failed,
  and the fallback fired. Nothing else writes that key.

## Rules

- **A feature flag with a server half and a client half is one flag and must be
  flipped in one commit.** The Worker var opens the endpoint; the
  `NEXT_PUBLIC_` mirror opens the surface. Either alone is invisible — one
  serves nobody, the other advertises what it cannot deliver. Both are
  documented next to each other in `.env.sample` and mapped in `deploy.yml`;
  a `NEXT_PUBLIC_*` missing from the workflow is silently absent in prod.
- **Whenever a tier gains a default it cannot choose away from, give it an
  escape in the same change.** The chooser's list and the tier's list differ
  exactly where a tier cannot switch, which is exactly where a failure has
  nowhere to go. Fallback logic reads the tier list.
- **A grep count is not evidence about a bundle.** Comments survive in dev
  chunks and inlined values erase their own names, so the count answers
  neither question. Slice the source around the symbol and read it.
