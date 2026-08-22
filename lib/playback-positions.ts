// Where playback stopped, per title and per episode.
//
// The iframe could never report a position — a cross-origin frame tells the
// page nothing — so watch history here has always been "an episode was
// started", never "watched up to 34:12". Our own player finally can, and
// this tiny store is where it writes.
//
// Deliberately NOT one of the shared WatchedItem arrays (`watchedItems` &
// co.): those feed behavioral stats and a position tick every few seconds
// would spam both. It is its own localStorage map — but it DOES sync now, as
// the `resume` store through lib/library-sync.ts, because "resume from where I
// stopped" that only works on the device you stopped on is not resume.
// See RESUME_DEBOUNCE_MS there for why these rows sync on a longer fuse than
// everything else.

export interface PlaybackPosition {
  position_seconds: number
  duration_seconds?: number
  updated_at: string
}

/** The localStorage key. Sync reads and writes it too — keep it stable. */
export const PLAYBACK_STORAGE_KEY = 'reely:playback'

const STORAGE_KEY = PLAYBACK_STORAGE_KEY

/** Movies key on the title; episodes key on the exact episode. */
export const playbackKey = (
  type: 'movie' | 'tv',
  id: number,
  season?: number,
  episode?: number
): string =>
  type === 'tv' && season && episode
    ? `tv:${id}:${season}:${episode}`
    : `${type}:${id}`

/**
 * A position worth picking back up, or null when there is effectively none:
 * shorter than the intro-skip margin, or close enough to the end that the
 * right move is starting over rather than landing on the credits.
 */
export const resumableSeconds = (
  entry: PlaybackPosition | null | undefined,
  duration?: number
): number | null => {
  if (!entry) return null
  const { position_seconds: position } = entry
  if (!Number.isFinite(position) || position < 20) return null
  const total = duration ?? entry.duration_seconds
  if (typeof total === 'number' && total > 0 && position >= total * 0.95) {
    return null
  }
  return position
}

/** The whole map, once — the sync engine diffs it against its mirror. */
export const readPositionMap = (): Record<string, PlaybackPosition> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const writePositionMap = (
  map: Record<string, PlaybackPosition>
): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // quota, private mode, corrupt JSON — a position is never worth throwing for
  }
}

export const readPosition = (key: string): PlaybackPosition | null => {
  return readPositionMap()[key] ?? null
}

export const writePosition = (
  key: string,
  positionSeconds: number,
  durationSeconds?: number
): void => {
  const map = readPositionMap()
  map[key] = {
    position_seconds: Math.floor(positionSeconds),
    ...(durationSeconds && durationSeconds > 0
      ? { duration_seconds: Math.floor(durationSeconds) }
      : {}),
    updated_at: new Date().toISOString(),
  }
  writePositionMap(map)
}

export const clearPosition = (key: string): void => {
  const map = readPositionMap()
  if (!(key in map)) return
  delete map[key]
  writePositionMap(map)
}

/** 75 -> "1:15"; 3675 -> "1:01:15". For the resume pill. */
export const formatPlaybackTime = (totalSeconds: number): string => {
  const whole = Math.max(0, Math.floor(totalSeconds))
  const seconds = String(whole % 60).padStart(2, '0')
  const minutes = String(Math.floor(whole / 60) % 60).padStart(2, '0')
  const hours = Math.floor(whole / 3600)
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}
