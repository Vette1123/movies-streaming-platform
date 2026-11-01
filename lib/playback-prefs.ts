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
//
// What counts as a valid preference lives in lib/playback-options.ts, shared
// with the account route and the ticket mint.
import { accountSnapshot, savePrefs } from '@/lib/account'
import { validPlaybackPrefs, type PlaybackPrefs } from '@/lib/playback-options'
import { dropWarmTickets } from '@/lib/pro/ticket-cache'

export type { PlaybackPrefs }

const KEY = 'reely_playback_prefs'

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
  return { ...readMirror(), ...validPlaybackPrefs(accountPrefs) }
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
  sub: 'off',
  ...validPlaybackPrefs(prefs),
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
export function prefsFromPlayer(
  data: Record<string, unknown>
): PlaybackPrefs | null {
  const patch = validPlaybackPrefs(data)
  if (data.quality === 0) patch.quality = undefined
  return Object.keys(patch).length ? patch : null
}
