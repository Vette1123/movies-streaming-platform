'use client'

// Playback preferences for the Reely Player, and how they travel.
//
// The player runs inside a cross-origin iframe on its own worker, so these
// cannot be read from account state at play time without an extra round trip
// ahead of every playback. Instead they are written to BOTH places:
//
//   - the synced account (`prefs.playback`, via savePrefs) — the source of
//     truth, carried across devices;
//   - a localStorage mirror — what a visitor with no account (or no answer
//     from the account yet) boots with.
//
// They are set from three places: Settings, the gear over the player, and the
// player's OWN subtitle, quality and audio menus and its full-screen bar
// switch, which post their picks back here
// (components/player/reely-player.tsx). That last one is the one people use,
// and until it reported anything a language picked in the player was gone by
// the next episode.
import { accountSnapshot, savePrefs } from '@/lib/account'
import { dropWarmTickets } from '@/lib/pro/ticket-cache'

export interface PlaybackPrefs {
  /**
   * Preferred external subtitle language (ISO code served by the player
   * worker), or 'off' for none.
   */
  sub?: string
  /** Subtitle text size. */
  subSize?: 's' | 'm' | 'l'
  /**
   * Keep ArtPlayer's thin progress line lit in full screen once the controls
   * hide. Off by default: in a window it is orientation, filling a phone
   * screen it is a bright strip across the picture for the whole film.
   */
  miniBar?: boolean
  /**
   * A quality rung picked in the player (1080 = 1080p). Absent means Auto.
   * The player pins the closest rendition at or under it on boot.
   */
  quality?: number
  /**
   * The audio language picked in the player's audio menu (ISO code). Absent
   * means the stream's own default; a title without it keeps its default.
   */
  audio?: string
}

const KEY = 'reely_playback_prefs'

/** The rungs the player names (reely-pro-player src/quality.mjs). */
const QUALITY_RUNGS = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144]

const isRung = (value: unknown): value is number =>
  typeof value === 'number' && QUALITY_RUNGS.includes(value)

const SUB_CODE = /^(off|[a-z]{2,3})$/
const LANG_CODE = /^[a-z]{2,3}$/

const readMirror = (): PlaybackPrefs => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PlaybackPrefs) : {}
  } catch {
    return {}
  }
}

/**
 * What the player should apply right now: the account first, then this
 * device's mirror.
 *
 * The account wins because it is the only copy another device can have moved,
 * and savePrefs updates it optimistically, so it also already holds anything
 * this tab just wrote. The mirror used to win, and a phone that had picked
 * Arabic once kept Arabic forever, whatever was chosen everywhere else.
 */
export function readPlaybackPrefs(
  accountPrefs?: PlaybackPrefs | null
): PlaybackPrefs {
  const local = readMirror()
  return {
    sub: accountPrefs?.sub ?? local.sub,
    subSize: accountPrefs?.subSize ?? local.subSize,
    miniBar: accountPrefs?.miniBar ?? local.miniBar,
    quality: accountPrefs?.quality ?? local.quality,
    audio: accountPrefs?.audio ?? local.audio,
  }
}

/** The prefs in force for this visitor, from wherever they live. */
export const currentPlaybackPrefs = (): PlaybackPrefs =>
  readPlaybackPrefs(accountSnapshot().prefs.playback)

/**
 * Drop anything malformed, and spell out "off" so an account copy overrides a
 * mirror. `miniBar: false` is kept for the same reason: it used to be dropped,
 * so turning the bar off anywhere left the account silent and every device's
 * own old "on" decided instead.
 */
export const cleanPrefs = (prefs: PlaybackPrefs): PlaybackPrefs => ({
  sub: prefs.sub && SUB_CODE.test(prefs.sub) ? prefs.sub : 'off',
  ...(prefs.subSize ? { subSize: prefs.subSize } : {}),
  ...(typeof prefs.miniBar === 'boolean' ? { miniBar: prefs.miniBar } : {}),
  ...(isRung(prefs.quality) ? { quality: prefs.quality } : {}),
  ...(prefs.audio && LANG_CODE.test(prefs.audio) ? { audio: prefs.audio } : {}),
})

/**
 * Persist a change everywhere the preference lives, and return the whole set
 * as written. Takes a PATCH: the player reports one field at a time.
 */
export async function writePlaybackPrefs(
  patch: PlaybackPrefs
): Promise<PlaybackPrefs> {
  const clean = cleanPrefs({ ...currentPlaybackPrefs(), ...patch })
  try {
    window.localStorage.setItem(KEY, JSON.stringify(clean))
  } catch {
    // Storage denied — the account copy still carries it.
  }
  // A ticket warmed before this change carries the old prefs in its URL.
  dropWarmTickets()
  // Signed out (a free trial play): the mirror is the whole store, and a
  // savePrefs here would mark an account that does not exist as changed.
  if (accountSnapshot().signedIn) void savePrefs({ playback: clean })
  return clean
}

/**
 * The patch a `{ kind: 'prefs' }` message from the player carries, or null when
 * it carries nothing usable. The message crosses an origin boundary, so every
 * field is checked rather than trusted. `quality: 0` is the player saying Auto.
 */
export function prefsFromPlayer(data: {
  sub?: unknown
  quality?: unknown
  audio?: unknown
  miniBar?: unknown
}): PlaybackPrefs | null {
  const patch: PlaybackPrefs = {}
  if (typeof data.sub === 'string' && SUB_CODE.test(data.sub)) {
    patch.sub = data.sub
  }
  if (typeof data.audio === 'string' && LANG_CODE.test(data.audio)) {
    patch.audio = data.audio
  }
  if (typeof data.miniBar === 'boolean') patch.miniBar = data.miniBar
  if (data.quality === 0) patch.quality = undefined
  else if (isRung(data.quality)) patch.quality = data.quality
  return Object.keys(patch).length ? patch : null
}
