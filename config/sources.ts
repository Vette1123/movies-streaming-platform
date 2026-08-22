/**
 * Where a stream can come from, in the order worth trying.
 *
 * Reely had exactly one embed provider. That is fine right up until the moment
 * it is down or simply does not carry a title — and then the visitor gets a
 * black rectangle that never resolves, with nothing on screen to say the fault
 * is upstream. Measured against everything else this site can do wrong, that is
 * the worst experience it produces, and it is entirely fixable: the providers
 * take the same shape of URL, so a second one is a different base and nothing
 * else.
 *
 * **No provider host appears in this repository or on screen.** Every base comes
 * from the environment, and the UI names them "Server 1/2/3". This repo is
 * public, and a hard-coded list of embed hosts is both a maintenance trap (they
 * move) and free advertising for someone else's ad revenue.
 *
 * What that does NOT buy is secrecy: the chosen URL is the `src` of a visible
 * iframe, so anyone who opens devtools reads it. The goal here is that the site
 * does not *publish* the list — not that a determined visitor cannot find one.
 *
 * The list is ordered; position 0 is what a visitor gets without choosing.
 *
 * Adding one: screen it with `pnpm embed:probe` FIRST. A provider that refuses
 * to load, redirects to an interstitial, or serves a different URL shape is not
 * a fallback, it is a second way to fail. See lib/embed-policy.ts for why the
 * frame carries no `sandbox` and what that costs.
 */
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'

/**
 * The house player's stable key. Its playback does not go through `base` at
 * all — see components/player/reely-player.tsx — but it rides the same
 * source list, switcher and per-title memory as every embed.
 */
export const REELY_SOURCE_ID = 'reely'

export interface StreamSource {
  /** Stable key. Derived from the host, and never shown. */
  id: string
  /** What a visitor sees. Deliberately says nothing about who serves it. */
  label: string
  /** Everything before `/movie/<id>`, no trailing slash. */
  base: string
}

/**
 * Every base worth trying, most-preferred first, all from the environment.
 *
 * Next inlines `NEXT_PUBLIC_*` textually, so these must be read as whole
 * identifiers — `process.env[name]` in a loop resolves to nothing at build time
 * and every fallback would silently vanish.
 */
const BASES: (string | undefined)[] = [
  STREAMING_MOVIES_API_URL,
  process.env.NEXT_PUBLIC_STREAM_SOURCE_2,
  process.env.NEXT_PUBLIC_STREAM_SOURCE_3,
]

const hostOf = (base: string): string => {
  try {
    return new URL(base).host
  } catch {
    // A malformed base is a configuration error, not a runtime one. Fall back to
    // something stable rather than throwing during module init and taking every
    // detail page with it.
    return base
  }
}

function buildSources(): StreamSource[] {
  const seen = new Set<string>()
  const out: StreamSource[] = []

  // The house player leads the list. It is not an embed: `base` is empty and
  // playback goes through ReelyPlayer, which exchanges a signed ticket with
  // our own worker for a direct HLS stream — no third-party page, no ads.
  // Position 0 means it is what every visitor gets without choosing; when
  // PRO_PLAYER_OPEN is lifted it becomes the supporter default (the ticket
  // endpoint enforces that server-side) while these embeds remain the
  // everyone fallback.
  out.push({ id: REELY_SOURCE_ID, label: 'Reely Player', base: '' })

  for (const base of BASES) {
    const trimmed = base?.trim().replace(/\/$/, '')
    if (!trimmed) continue
    const id = hostOf(trimmed)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, label: `Server ${out.length}`, base: trimmed })
  }

  return out
}

export const STREAM_SOURCES: StreamSource[] = buildSources()

export const DEFAULT_SOURCE_ID: string = STREAM_SOURCES[0]?.id ?? ''

/** True only when there is somewhere else to go. The UI hides itself otherwise. */
export const HAS_FALLBACK_SOURCE = STREAM_SOURCES.length > 1

export const sourceById = (id: string | null | undefined): StreamSource =>
  STREAM_SOURCES.find((source) => source.id === id) ?? STREAM_SOURCES[0]

/** The film URL. Every provider on the list takes this shape. */
export const movieStreamUrl = (source: StreamSource, id: number): string =>
  `${source.base}/movie/${id}`

/**
 * The episode URL, or the series root when no episode is named.
 *
 * The root is what plays when somebody presses the hero's play button on a show
 * they have never opened: the provider picks the first episode, which is the
 * right answer and is what the single-source version did.
 */
export const seriesStreamUrl = (
  source: StreamSource,
  id: number,
  target?: { season: number; episode: number } | null
): string => {
  const base = `${source.base}/tv/${id}`
  return target ? `${base}/${target.season}/${target.episode}` : base
}
