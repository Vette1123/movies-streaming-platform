# The room code was also the remote

## What

Closed everything the previous pass left open or declined
(2026-09-23-five-features-had-never-shipped):

- **Remote auth.** The phone remote steered the host's player with nothing but
  the room code — which every guest holds. Rooms now mint a 128-bit
  `remote_key` (migration 0010), handed to the host alone
  (`hostHref` → `?rk=`), carried only by the QR (`remoteHref`), stripped from
  every invite (`inviteHref` drops `host`, `rk` AND `remote`), and required by
  `/api/together/remote` in its single UPDATE, which now matches on code AND
  key. A wrong key and a missing room are the same 404. Rooms from
  before the key have no Remote button; a `remote=1` link without a key opens
  as a plain guest instead of a pad that fails every press.
- **CI applies D1 migrations** ahead of `deploy:full`. Proven before relying on
  it: applied 0010 to production with the same non-interactive invocation
  (`CI=true`, stdin closed) — exit 0.
- **Worker positions** are finite and ≤ 24h on both beat and remote.
- **Host label** said "you control playback" in a swept room.
- **Share card**: long titles break into two balanced lines
  (`layoutHeadline`, lib/canvas-card.ts) instead of shrinking to a ~40px
  caption; art walks the site's ImageKit → wsrv → TMDB chain inside the one
  timeout; the card starts drawing on hover/focus/touch and the click reuses it
  (verified: one `toBlob`, before the click).
- **Triple** says "a long night" when nothing on the list fits the evening.

## Mistakes

- Last pass I declined the remote-key fix with "the room code is already the
  capability — `/api/together/beat` is unauthenticated too". The comparison
  was wrong: a forged beat moves guests for at most one 4-second tick before
  the host overwrites it; a remote command moves the HOST, and through the host
  the whole room, for as long as the guest keeps pressing. Same credential,
  different blast radius — the decline was rationalised from the weaker case.
- The first cut of the intent-warmed card rethrew a failed render from the
  cached promise. A hover nobody followed with a click would have surfaced as
  an unhandled rejection — which PostHog captures as an error. It resolves null
  now. Second hole in the same first cut: the cache was not keyed by title, and
  a client navigation can hand the same button instance the next film.
- Reached for `sed` on CLAUDE.md with a pattern anchored at line start that
  could not match (the note sits mid-paragraph). Harmless only because it
  matched nothing; the edit was redone with an exact-string replace.

## What worked

- Proving the CI path on the real target before wiring it: one apply with the
  flags CI will use turned "the token probably has D1 Edit" into a fact, and
  landed the schema ahead of the Worker that needs it.
- Every UI claim checked in the browser, including the unhappy states the
  hidden automation tab normally hides: overriding `document.hidden` let the
  host loop run and show "the room has ended"; a `toBlob` spy showed the draw
  happening on hover, not click.

## Rules

- Judge a capability by what it moves, not by what else shares it. A credential
  good enough for a follower is not good enough for the driver.
- A value cached on intent must never reject into the void, and must be keyed
  by what it was built for.
- Migrations run in CI before the Worker deploys; a failure there stops the
  deploy with the old Worker still serving.
