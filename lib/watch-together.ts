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
