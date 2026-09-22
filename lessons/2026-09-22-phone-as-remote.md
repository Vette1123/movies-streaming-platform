# Phone as remote (Watch Together)

## What

Host scans a QR in the room bar; the phone opens the same title with
`remote=1` and shows a `-10 / play-pause / +10` pad. Each press writes a
one-shot command (`cmd_position`, `cmd_playing`, `cmd_at`) to the existing
`together_beats` row; the host's 4-second loop drains it into the same
`postMessage` path the guest follower already uses. No new transport, no
WebSocket, no second D1 table.

Files: `migrations/0009_together_remote.sql`, `cloudflare/worker.js`
(`/api/together/remote` + state SELECT + POST allowlist),
`lib/api-client.ts` (`togetherRemoteApi`, `TogetherBeat.cmd_*`),
`lib/watch-together.ts` (`planRemoteCommand`, `inviteHref`, `remoteHref`),
`components/together-remote.tsx` (new), `components/watch-together-bar.tsx`
(push hoist, drain-before-beat, QR dialog, invite fix),
`components/details-hero.tsx` (`remote=1` branch).

## Mistakes

- The invite copy button was sending `location.href`, which on the host still
  carries `host=1` — every invitee would have opened a second host loop
  fighting over the beat. Fixed by routing the clipboard through `inviteHref`,
  which drops the flag; `remoteHref` is the same strip plus `remote=1`.
- The host loop originally wrote its beat before it would ever have looked for
  a command, so a remote pause would be overwritten by the host's own position
  a beat later. Drain first, write only when no command applied.
- Nearly built a second poller on the phone → host path (phone posts, host
  receives via its own GET). The GET was already there; the command columns
  ride the row the state endpoint already returns, so the phone needs no
  channel of its own beyond one POST.

## What worked

- Reusing `STALE_BEAT_MS` (20 s) as the command TTL: a phone press that
  surfaces after the host tab was hidden that long is dropped, matching the
  rule the guest follower already applies to a dead host.
- `planRemoteCommand(cmd, appliedAt, now)` as a pure function with its own
  `describe`: applied/already-applied/stale/null are all decided without a
  frame, a Worker, or a timer.
- Rendering the QR on a white plate regardless of theme — the bar sits over
  the player, where a transparent code has no quiet zone.

## Rules

- One-shot commands are drained by the EXISTING host loop, never by a
  dedicated listener; a second transport is how this feature becomes two
  features to keep in sync.
- Strip `host=1` from anything you put on a clipboard or in a QR payload;
  `inviteHref` / `remoteHref` in `lib/watch-together.ts` are the only two
  href builders for a room.
- Ceiling (known, accepted): the command reaches the house player only — an
  embed accepts no steering, so a host on a third-party server sees the pad
  light up and the film ignores it. The bar's existing comment already says
  this about guests; it applies to remotes too.
- The host GET poll costs one extra Worker invocation per 4 s while a room is
  open (it was already paying for the beat write; now it also reads state
  before writing). Rooms are short-lived and swept at 6 h — acceptable, but
  do not shorten the interval.
- Apply `migrations/0009_together_remote.sql` before deploying the Worker
  that selects the new columns (`pnpm d1:migrate:remote`).
