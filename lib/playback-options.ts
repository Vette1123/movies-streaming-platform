// The Reely Player's saved options, as closed sets, and the one check of them.
//
// Pure on purpose: the account panel, the browser's prefs, the server's account
// route and the ticket mint in the Worker all read this file. The server used
// to keep its own short list, so every field added later looked saved and was
// dropped on the way into the account.
//
// The ids are the player's (reely-pro-player src/player-options.mjs). A new id
// goes in both repos.

export interface PlaybackPrefs {
  /**
   * Preferred external subtitle language (ISO code served by the player
   * worker), or 'off' for none.
   */
  sub?: string
  /** Subtitle text size. */
  subSize?: 's' | 'm' | 'l'
  /** Subtitle text colour. */
  subColor?: string
  /** What sits behind the subtitle text. */
  subBack?: string
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
  /** How the picture sits in the frame. */
  fit?: string
  /** A lift on dark titles: 1 is the picture as it was graded. */
  brightness?: number
  /** Sound past the element's maximum: 1 is off. */
  boost?: number
  /** Loud scenes down, quiet dialogue up. */
  night?: boolean
  /**
   * Jump intros and recaps without the button. Off by default: the timings are
   * crowd-sourced and a provider's cut can sit seconds away from them.
   */
  autoSkip?: boolean
}

export const SUB_SIZES = [
  { id: 's', label: 'Small', scale: 0.8 },
  { id: 'm', label: 'Medium', scale: 1 },
  { id: 'l', label: 'Large', scale: 1.3 },
] as const

export const SUB_COLORS = [
  { id: 'white', label: 'White', swatch: '#ffffff' },
  { id: 'yellow', label: 'Yellow', swatch: '#ffe45c' },
  { id: 'cyan', label: 'Cyan', swatch: '#7deeff' },
  { id: 'green', label: 'Green', swatch: '#a6f28a' },
] as const

export const SUB_BACKS = [
  {
    id: 'box',
    label: 'Dark box',
    background: 'rgba(0, 0, 0, 0.75)',
    textShadow: 'none',
  },
  {
    id: 'soft',
    label: 'Soft box',
    background: 'rgba(0, 0, 0, 0.4)',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
  },
  {
    id: 'none',
    label: 'Outline only',
    background: 'transparent',
    textShadow:
      '0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000, -1px -1px 2px #000',
  },
] as const

export const FITS = [
  { id: 'fit', label: 'Fit' },
  { id: 'fill', label: 'Fill screen' },
  { id: '16:9', label: '16:9' },
  { id: '4:3', label: '4:3' },
] as const

export const BRIGHTNESS_LEVELS = [
  { id: '1', label: 'Normal' },
  { id: '1.2', label: 'Brighter' },
  { id: '1.4', label: 'Brightest' },
] as const

export const BOOST_LEVELS = [
  { id: '1', label: 'Off' },
  { id: '1.5', label: '150%' },
  { id: '2', label: '200%' },
] as const

export const QUALITY_CHOICES = [
  { id: 'auto', label: 'Auto' },
  { id: '2160', label: '4K' },
  { id: '1080', label: '1080p' },
  { id: '720', label: '720p' },
  { id: '480', label: '480p' },
] as const

export const MINI_BAR = [
  { id: 'hidden', label: 'Hidden' },
  { id: 'shown', label: 'Shown' },
] as const

/** The player leaves the boost at 150% until somebody chooses. */
export const DEFAULT_BOOST = 1.5

/** The rungs the player names (reely-pro-player src/quality.mjs). */
const QUALITY_RUNGS = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144]

const SUB_CODE = /^(off|[a-z]{2,3})$/
const LANG_CODE = /^[a-z]{2,3}$/

const hasId = (options: readonly { id: string }[], value: unknown): boolean =>
  options.some((option) => option.id === value)

/** Numeric options are stored as numbers and listed as strings for the chips. */
const hasLevel = (
  options: readonly { id: string }[],
  value: unknown
): boolean => typeof value === 'number' && hasId(options, String(value))

/**
 * Every valid field of anything claiming to be playback prefs, and nothing
 * else. It reads what a browser posts and what another origin's frame sends, so
 * no field is trusted, and every value out of here is safe in a URL.
 */
export function validPlaybackPrefs(input: unknown): PlaybackPrefs {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: PlaybackPrefs = {}
  if (typeof raw.sub === 'string' && SUB_CODE.test(raw.sub)) out.sub = raw.sub
  if (hasId(SUB_SIZES, raw.subSize)) {
    out.subSize = raw.subSize as PlaybackPrefs['subSize']
  }
  if (hasId(SUB_COLORS, raw.subColor)) out.subColor = raw.subColor as string
  if (hasId(SUB_BACKS, raw.subBack)) out.subBack = raw.subBack as string
  if (typeof raw.miniBar === 'boolean') out.miniBar = raw.miniBar
  if (typeof raw.quality === 'number' && QUALITY_RUNGS.includes(raw.quality)) {
    out.quality = raw.quality
  }
  if (typeof raw.audio === 'string' && LANG_CODE.test(raw.audio)) {
    out.audio = raw.audio
  }
  if (hasId(FITS, raw.fit)) out.fit = raw.fit as string
  if (hasLevel(BRIGHTNESS_LEVELS, raw.brightness)) {
    out.brightness = raw.brightness as number
  }
  if (hasLevel(BOOST_LEVELS, raw.boost)) out.boost = raw.boost as number
  if (typeof raw.night === 'boolean') out.night = raw.night
  if (typeof raw.autoSkip === 'boolean') out.autoSkip = raw.autoSkip
  return out
}

/**
 * The player's query parameters for a ticket. Booleans travel both ways: every
 * toggle lands in the account, so it is the newest choice and the player obeys
 * it over its device copy. Absent means nobody has chosen.
 */
export function playerParams(input: unknown): [string, string][] {
  const prefs = validPlaybackPrefs(input)
  const params: [string, string | undefined][] = [
    ['sub', prefs.sub],
    ['subs', prefs.subSize],
    ['subc', prefs.subColor],
    ['subb', prefs.subBack],
    ['q', prefs.quality?.toString()],
    ['al', prefs.audio],
    ['fit', prefs.fit],
    ['br', prefs.brightness?.toString()],
    ['boost', prefs.boost?.toString()],
  ]
  if (prefs.miniBar !== undefined) {
    params.push(['mini', prefs.miniBar ? '1' : '0'])
  }
  if (prefs.night !== undefined) params.push(['nm', prefs.night ? '1' : '0'])
  if (prefs.autoSkip !== undefined) {
    params.push(['as', prefs.autoSkip ? '1' : '0'])
  }
  return params.filter((entry): entry is [string, string] => Boolean(entry[1]))
}

/** The inline style of a subtitle line, for the preview in Settings. */
export function subtitlePreviewStyle(prefs: PlaybackPrefs) {
  const size = SUB_SIZES.find((option) => option.id === prefs.subSize)
  const color = SUB_COLORS.find((option) => option.id === prefs.subColor)
  const back = SUB_BACKS.find((option) => option.id === prefs.subBack)
  return {
    fontSize: `${size?.scale ?? 1}rem`,
    color: color?.swatch ?? SUB_COLORS[0].swatch,
    background: back?.background ?? SUB_BACKS[0].background,
    textShadow: back?.textShadow ?? SUB_BACKS[0].textShadow,
  }
}
