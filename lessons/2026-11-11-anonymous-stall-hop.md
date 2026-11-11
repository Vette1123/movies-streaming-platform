# Anonymous viewers get the one automatic hop

## What

The one automatic hop after a 9 s boot stall used to need a free account,
together with choosing a server. PostHog for the 14 days to 2026-11-11: 65 of
67 boot stalls were anonymous viewers. 61 anonymous sessions stalled; 7 then
started the free Reely Player trial and 3 signed in. The other ~51 sat on a
dead default with no way off it.

The hop now reaches everyone (`rescueSourcesFor` in `config/sources.ts`).
Choosing a server and the per-title memory stay behind the account
(`canSwitch`, enforced in `select`). An automatic hop still saves nothing, so an
anonymous visit gains no stored state. If the second server stalls too, the
same sign-in and trial offers appear as before.

The stall notice also lied. It only ever shows on a server that is still dead,
which after the hop is the second one, and it said "Trying another" there, when
nothing more would be tried. It now says "Two servers did not respond"
(`stallNoticeText` in `lib/player-hop.ts`, shared by both branches).

## Mistakes

- **The first double-stall rig hopped straight to Server 3.** Both hanging
  slots were on `127.0.0.1`, and a source id is its hostname, so the two slots
  became one. Give each fake server its own host (`127.0.0.1` and `localhost`).
- **`127.0.0.1:3100` never hydrated.** Next's dev server refuses its client
  bundles to an origin outside `allowedDevOrigins`, so the page painted and
  every button was dead. Drive the dev server on `localhost`.
- A source-text test pinned the literal `if (!isViewerChoice(via))`; renaming
  the guard to a local turned it red. It now pins both the local and the guard.

## What worked

- Asking PostHog what anonymous viewers did after a stall, before touching
  the gate. The account gate was there to sell sign-ups; 3 sign-ups in 61
  sessions is not worth 51 dead players.
- A hanging local server (accepts, never answers) as slot 1, the real provider
  as slot 2: the hop showed on the iframe src at 8–9 s, and localStorage stayed
  empty.

## Rules

- A rescue is not a choice: gate the chooser, not the recovery.
- Fake stream servers in a test rig each need a distinct hostname.
