'use client'

// Playback preferences for the Reely Player, and how they travel.
//
// The player runs inside a cross-origin iframe on its own worker, so these
// cannot be read from account state at play time without an extra round trip
// ahead of every playback. Instead they are written to BOTH places:
//
//   - the synced account (`prefs.playback`, via savePrefs) — the source of
//     truth, carried across devices;
//   - a localStorage mirror — what the ticket request actually reads, so the
//     player boots with the right subtitles even before any account refresh.
//
// The mirror is a cache of the user's own choice, never a credential; losing
// it costs nothing because the next settings save rewrites it.

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
}

const KEY = 'reely_playback_prefs'

/** What the player should apply right now: mirror first, then account. */
export function readPlaybackPrefs(
  accountPrefs?: PlaybackPrefs | null
): PlaybackPrefs {
  let local: PlaybackPrefs = {}
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY)
      if (raw) local = JSON.parse(raw) as PlaybackPrefs
    } catch {
      local = {}
    }
  }
  return {
    sub: local.sub ?? accountPrefs?.sub,
    subSize: local.subSize ?? accountPrefs?.subSize,
    miniBar: local.miniBar ?? accountPrefs?.miniBar,
  }
}

/** Persist everywhere the preference lives, and return what was written. */
export async function writePlaybackPrefs(
  prefs: PlaybackPrefs
): Promise<PlaybackPrefs> {
  const clean: PlaybackPrefs = {
    ...(prefs.sub ? { sub: prefs.sub } : { sub: 'off' }),
    ...(prefs.subSize ? { subSize: prefs.subSize } : {}),
    ...(prefs.miniBar ? { miniBar: true } : {}),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(clean))
  } catch {
    // Storage denied — the account copy still carries it.
  }
  const { savePrefs } = await import('@/lib/account')
  void savePrefs({ playback: clean })
  return clean
}
