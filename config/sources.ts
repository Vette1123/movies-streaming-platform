/**
 * Where a stream can come from, in the order worth trying.
 *
 * Reely had exactly one embed provider. That is fine right up until the moment
 * it is down or simply does not carry a title — and then the visitor gets a
 * black rectangle that never resolves, with nothing on screen to say the fault
 * is upstream.
 *
 * **No provider host appears in this repository or on screen.** Every base comes
 * from the environment, and the UI names them by their configured labels (the
 * env vars below) rather than by host. This repo is public, and a hard-coded
 * list of embed hosts is both a maintenance trap and free advertising for
 * someone else's ad revenue.
 *
 * What that does NOT buy is secrecy: the chosen URL is the `src` of a visible
 * iframe, so anyone who opens devtools reads it. The goal here is that the site
 * does not *publish* the list — not that a determined visitor cannot find one.
 *
 * Switching is a SIGNED-IN feature: anonymous visitors always get the default
 * server only, so an account is the price of choice. Supporters additionally
 * get our own player as their automatic default.
 */
import {
  STREAMING_MOVIES_API_QUERY,
  STREAMING_MOVIES_API_URL,
} from '@/lib/constants'

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
  /** Origin of the embed, no trailing slash. */
  base: string
  /**
   * URL path templates. `{id}`, `{s}`, `{e}` are substituted; defaults match
   * the vidsrc family (`/movie/{id}`, `/tv/{id}/{s}/{e}`). Per-slot env vars
   * (NEXT_PUBLIC_STREAM_SOURCE_N_MOVIE_PATH / _TV_PATH) let providers with a
   * different shape join the same list.
   */
  paths?: { movie: string; tv: string }
  /**
   * Extra query string appended to every playback URL, from the paired
   * NEXT_PUBLIC_STREAM_SOURCE_N_QUERY env var. How a slot carries player
   * customisation (brand colors, autoplay) for providers that accept it.
   * Empty by default — never append junk to a provider whose URLs are signed.
   */
  query?: string
}

interface Slot {
  slot: number
  label: string
  base?: string
  query?: string
  moviePath?: string
  tvPath?: string
}

/**
 * Every embed slot, entirely from the environment. Labels default to
 * "Server N"; bases may be empty (the slot simply does not exist). Next
 * inlines `NEXT_PUBLIC_*` textually, so these must be read as whole
 * identifiers — `process.env[name]` in a loop resolves to nothing at build
 * time and every fallback would silently vanish.
 */
const SLOTS: Slot[] = [
  {
    slot: 1,
    label:
      process.env.NEXT_PUBLIC_STREAMING_MOVIES_API_LABEL?.trim() || 'Server 1',
    base: STREAMING_MOVIES_API_URL,
    query: STREAMING_MOVIES_API_QUERY,
  },
  {
    slot: 2,
    label: process.env.NEXT_PUBLIC_STREAM_SOURCE_2_LABEL?.trim() || 'Server 2',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_2,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_2_QUERY,
  },
  {
    slot: 3,
    label: process.env.NEXT_PUBLIC_STREAM_SOURCE_3_LABEL?.trim() || 'Server 3',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_3,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_3_QUERY,
  },
  {
    slot: 4,
    label: process.env.NEXT_PUBLIC_STREAM_SOURCE_4_LABEL?.trim() || 'Server 4',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_4,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_4_QUERY,
    moviePath: process.env.NEXT_PUBLIC_STREAM_SOURCE_4_MOVIE_PATH,
    tvPath: process.env.NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH,
  },
  {
    slot: 5,
    label: process.env.NEXT_PUBLIC_STREAM_SOURCE_5_LABEL?.trim() || 'Server 5',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_5,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_5_QUERY,
    moviePath: process.env.NEXT_PUBLIC_STREAM_SOURCE_5_MOVIE_PATH,
    tvPath: process.env.NEXT_PUBLIC_STREAM_SOURCE_5_TV_PATH,
  },
]

/**
 * Which SLOT is the public default. Server 2 since it has proven the more
 * resilient embed. Overridable per deployment without touching code; falls
 * back to the first configured slot otherwise.
 */
const DEFAULT_SLOT = Number(
  process.env.NEXT_PUBLIC_STREAM_DEFAULT_SLOT?.trim() || '2'
)

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
  const built: StreamSource[] = []

  for (const slot of SLOTS) {
    const trimmed = slot.base?.trim().replace(/\/$/, '')
    if (!trimmed) continue
    const id = hostOf(trimmed)
    if (seen.has(id)) continue
    seen.add(id)
    const paths =
      slot.moviePath?.trim() && slot.tvPath?.trim()
        ? { movie: slot.moviePath.trim(), tv: slot.tvPath.trim() }
        : undefined
    built.push({
      id,
      label: slot.label,
      base: trimmed,
      ...(paths ? { paths } : {}),
      ...(slot.query?.trim() ? { query: slot.query.trim() } : {}),
    })
  }

  // Lead with the default slot so position 0 is what every fresh visitor —
  // and the resolution fallbacks below — treat as "the server". Stable sort
  // keeps the remaining slots in their configured order.
  const defaultLabel =
    SLOTS.find((s) => s.slot === DEFAULT_SLOT)?.label ?? 'Server 1'
  built.sort(
    (a, b) =>
      Number(b.label === defaultLabel) - Number(a.label === defaultLabel)
  )

  return built
}

export const STREAM_SOURCES: StreamSource[] = buildSources()

export const DEFAULT_SOURCE_ID: string = STREAM_SOURCES[0]?.id ?? ''

/** True only when there is somewhere else to go. The UI hides itself otherwise. */
export const HAS_FALLBACK_SOURCE = STREAM_SOURCES.length > 1

/**
 * The supporters-only surface: OUR OWN player. Offered, NOT the default.
 *
 * Enabled deployment-wide by NEXT_PUBLIC_PRO_TRIAL_SELFHOST=true — it needs
 * the playback worker plus a gado-proxy tier behind it (see the
 * reely-resolver-relay repo) to serve bytes, since no provider hands out
 * origin-open segments. Deliberately NOT part of STREAM_SOURCES: it never
 * exists for visitors without an entitled account, so the public journey is
 * untouched down to the URL.
 *
 * It led the list until 2026-09-05, when the provider closed the last door it
 * needed. Measured that day, both directions:
 *
 *   - Manifest and segments ARE readable from our own origin (CORS 200), so
 *     the player itself is fine.
 *   - The playlist token is bound to the IP that MINTED it: the same token
 *     that streams instantly in a browser gets 403 from our egress, with the
 *     correct Referer, from their origin server rather than their WAF.
 *   - Minting it needs `/api/movie/<id>` and `/embed/<id>`, and those answer
 *     403 to every datacenter IP AND send no CORS header to our origin — so
 *     neither our servers nor the visitor's browser can mint one.
 *
 * Only a browser on the provider's own page can, which is the iframe they
 * sell. So the house player resolves nothing, falls through to that iframe
 * anyway, and leading with it bought every supporter two dead round trips
 * before the picture. Until a provider exists whose bytes we can actually
 * reach, it goes last. See lessons/2026-09-05-pro-player-egress-403.md.
 */
const SELFHOST_TRIAL = process.env.NEXT_PUBLIC_PRO_TRIAL_SELFHOST === 'true'

export const RICH_SOURCE: StreamSource | null = SELFHOST_TRIAL
  ? {
      id: REELY_SOURCE_ID,
      label: 'Reely Beta',
      // Never fetched: every hero routes this id to ReelyPlayer before any
      // URL is built. The placeholder keeps StreamSource's shape honest — if
      // something DID try, .invalid fails fast instead of leaking a provider.
      base: 'https://reely-beta.invalid',
    }
  : null

/**
 * The list a given visitor may choose between.
 *
 * - Anonymous: the default server only. Choice costs an account.
 * - Signed-in free: every embed slot.
 * - Supporters: every embed slot, then our player last.
 *
 * Position 0 is not a ranking, it is what plays when nobody chooses — free
 * visitors only ever get `sources[0]`, and the stall detector's automatic hop
 * walks forward from it. So the slot has to hold the source most likely to
 * paint a frame, and today that is an embed, not ours.
 *
 * Callers must treat the result as the validation set for stored source ids —
 * an id remembered under one tier has to resolve to nothing if the tier loses
 * access to it (lapsed support, signed out).
 */
export const visibleSourcesFor = (
  signedIn: boolean,
  pro: boolean
): StreamSource[] => {
  if (!signedIn) return STREAM_SOURCES.slice(0, 1)
  if (pro && RICH_SOURCE) return [...STREAM_SOURCES, RICH_SOURCE]
  return STREAM_SOURCES
}

export const sourceById = (id: string | null | undefined): StreamSource =>
  STREAM_SOURCES.find((source) => source.id === id) ?? STREAM_SOURCES[0]

/** Fill a slot's path template. Unknown tokens pass through untouched. */
const fillPath = (
  template: string,
  vars: { id: number; s?: number; e?: number }
): string =>
  template
    .replace('{id}', String(vars.id))
    .replace('{s}', String(vars.s ?? 1))
    .replace('{e}', String(vars.e ?? 1))

/** The film URL, honoring the source's path shape. */
export const movieStreamUrl = (source: StreamSource, id: number): string =>
  withSourceQuery(
    `${source.base}${(source.paths?.movie ?? '/movie/{id}').replace(
      '{id}',
      String(id)
    )}`,
    source
  )

/**
 * The episode URL, or the series root when no episode is named.
 *
 * A series ROOT normalizes to the first episode: providers used to pick one
 * themselves off /tv/{id}, but a URL that names the episode works on every
 * path shape on the list and cannot be second-guessed.
 */
export const seriesStreamUrl = (
  source: StreamSource,
  id: number,
  target?: { season: number; episode: number } | null
): string => {
  const t = target ?? { season: 1, episode: 1 }
  const template = source.paths?.tv ?? '/tv/{id}/{s}/{e}'
  return withSourceQuery(
    `${source.base}${fillPath(template, { id, s: t.season, e: t.episode })}`,
    source
  )
}

/** Append the slot's configured query, if any. Never touches signed params. */
const withSourceQuery = (url: string, source: StreamSource): string =>
  source.query ? `${url}${url.includes('?') ? '&' : '?'}${source.query}` : url

/**
 * Which source a visitor plays from, given everything known about their intent.
 *
 * Pure and here rather than inside the hook because the ORDER is the whole
 * feature and it is worth a test: the bug it fixes was supporters whose
 * Settings choice was skipped entirely, so the house player was the only thing
 * they could ever play.
 *
 *  1. what they switched to on THIS title,
 *  2. what they chose in Settings (`prefs.source`) — deliberate, cross-device,
 *  3. what they last switched to on this device (free accounts only: one switch
 *     should not move a supporter off the player they pay for),
 *  4. the default embed.
 *
 * Step 4 used to hand supporters the house player. It stopped being a default
 * on 2026-09-05: it cannot resolve a stream from this provider at all (see
 * RICH_SOURCE above), so choosing it for someone who expressed no preference
 * only spent two dead round trips on their behalf. A supporter who WANTS it
 * still gets it through steps 1 and 2 — an explicit switch, or the Settings
 * choice — which is the difference between offering something and defaulting
 * to it.
 *
 * Anything not in `sources` is ignored: a stored id survives a tier change, and
 * a lapsed supporter must not resolve to the player they no longer have.
 */
export const resolveSourceId = (input: {
  sources: StreamSource[]
  remembered?: string | null
  accountSource?: string | null
  devicePreference?: string | null
  pro: boolean
}): string => {
  const has = (id?: string | null): id is string =>
    !!id && input.sources.some((entry) => entry.id === id)

  if (has(input.remembered)) return input.remembered
  if (has(input.accountSource)) return input.accountSource
  if (!input.pro && has(input.devicePreference)) return input.devicePreference
  return DEFAULT_SOURCE_ID
}
