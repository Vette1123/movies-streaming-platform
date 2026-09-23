// The one decision a Watch Together guest makes, as a pure function: given the
// host's last beat and where this player actually is, should we steer?
//
// It lives here rather than inside the bar's polling effect because it is the
// only part of the room with rules, and rules are what a test can hold.

/** How far out of step a guest may be before being pulled back, in seconds. */
export const DRIFT_TOLERANCE = 3

/** A host that stopped beating is a host that left. Following their last
 * "playing" beat forever drags the guest BACKWARDS every four seconds: the
 * guest's own clock keeps moving and the host's no longer does. */
export const STALE_BEAT_MS = 20000

export interface HostBeat {
  position: number
  playing: boolean
  /** Epoch ms, as the Worker wrote it. */
  updatedAt: number
}

export interface GuestState {
  position: number
  playing: boolean
}

/**
 * `null` means leave the guest alone. Otherwise it is what to apply.
 *
 * `mine` is null until the guest's own player has reported a position — an
 * embed that publishes nothing never reports one, and then position is all we
 * can go on.
 */
export const followHost = (
  beat: HostBeat,
  mine: GuestState | null,
  now: number
): GuestState | null => {
  // A paused host stops beating (the host skips a beat identical to the last),
  // so a stale PAUSE is just the room sitting still and stays worth following.
  if (beat.playing && now - beat.updatedAt > STALE_BEAT_MS) return null

  const drift = Math.abs(beat.position - (mine?.position ?? 0))
  // Play/pause has to follow even at zero drift: a host pausing in place moves
  // nothing, and a guest who only watched the clock played straight through it.
  const stateChanged = !!mine && mine.playing !== beat.playing
  if (drift <= DRIFT_TOLERANCE && !stateChanged) return null

  return { position: beat.position, playing: beat.playing }
}

export interface RemoteCommand {
  position: number
  playing: boolean
  /** Epoch ms, as the Worker wrote it (`cmd_at`). */
  updatedAt: number
}

/**
 * `null` means drop the command — either already applied (the host drained
 * `cmd_at` on an earlier tick) or too old to trust. A phone that presses pause,
 * walks away, and whose command finally surfaces after the room has moved on
 * would otherwise rewind playback; `STALE_BEAT_MS` is the same window the guest
 * follower already uses for a dead host.
 */
export const planRemoteCommand = (
  cmd: RemoteCommand | null,
  appliedAt: number,
  now: number
): { position: number; playing: boolean } | null => {
  if (!cmd) return null
  if (cmd.updatedAt <= appliedAt) return null
  if (now - cmd.updatedAt > STALE_BEAT_MS) return null
  return { position: cmd.position, playing: cmd.playing }
}

/**
 * What the phone pad should show. A command newer than the last beat is where
 * the host is ABOUT to be — the host skips its beat on the tick it drains one —
 * so showing the beat instead snapped the pad back and computed the next +10
 * from a stale position. A command that went stale undrained (host on an embed,
 * or away) no longer describes anything, so the beat wins again.
 */
export const remoteView = (
  state: {
    position: number
    playing: number | boolean
    updated_at: number
    cmd_position: number | null
    cmd_playing: number | null
    cmd_at: number | null
  },
  now: number
): { position: number; playing: boolean } => {
  const pending =
    state.cmd_at != null &&
    state.cmd_at > state.updated_at &&
    now - state.cmd_at <= STALE_BEAT_MS
  if (pending) {
    return {
      position: state.cmd_position ?? state.position,
      playing: !!state.cmd_playing,
    }
  }
  return { position: state.position, playing: !!state.playing }
}

/** The query param carrying the remote's key. Host URL and QR only — never an
 * invite: the room code is shared, the key is what steers the host's player. */
export const REMOTE_KEY_PARAM = 'rk'

/** Where the host lands after minting a room: `path` is the title's page. */
export const hostHref = (path: string, code: string, key: string): string =>
  `${path}?watch=${encodeURIComponent(code)}&host=1&${REMOTE_KEY_PARAM}=${encodeURIComponent(key)}`

/** The same URL a guest opens on their phone: playback params kept, `host`
 * and the remote key dropped — a guest polls, it neither hosts nor steers. */
export const inviteHref = (href: string): string => {
  const url = new URL(href)
  // The QUERY param. `url.host = ''` would target the hostname — a silent
  // no-op on https that shipped once and turned every invitee into a host.
  url.searchParams.delete('host')
  url.searchParams.delete(REMOTE_KEY_PARAM)
  url.searchParams.delete('remote')
  return url.toString()
}

/** The QR payload: the invite URL with `remote=1` (the detail hero mounts the
 * phone pad instead of the room bar) and the host's key put back, or null when
 * this room has no key — a room from before keys existed has no remote. */
export const remoteHref = (href: string): string | null => {
  const key = new URL(href).searchParams.get(REMOTE_KEY_PARAM)
  if (!key) return null
  const url = new URL(inviteHref(href))
  url.searchParams.set('remote', '1')
  url.searchParams.set(REMOTE_KEY_PARAM, key)
  return url.toString()
}
