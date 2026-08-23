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
  /** Everything before `/movie/<id>`, no trailing slash. */
  base: string
  /**
   * Extra query string appended to every playback URL, from the paired
   * NEXT_PUBLIC_STREAM_SOURCE_N_QUERY env var. How a slot carries player
   * customisation (brand colors, autoplay) for providers that accept it.
   * Empty by default — never append junk to a provider whose URLs are signed.
   */
  query?: string
}

/**
 * Every embed base, paired with the fixed label a visitor sees, all from the
 * environment. The label is pinned to the env slot (not derived from position)
 * so "Server 2" always means NEXT_PUBLIC_STREAM_SOURCE_2 regardless of ordering.
 *
 * Next inlines `NEXT_PUBLIC_*` textually, so these must be read as whole
 * identifiers — `process.env[name]` in a loop resolves to nothing at build time
 * and every fallback would silently vanish.
 */
const SLOTS: { label: string; base: string | undefined; query?: string }[] = [
  {
    label: 'Server 1',
    base: STREAMING_MOVIES_API_URL,
    query: STREAMING_MOVIES_API_QUERY,
  },
  {
    label: 'Server 2',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_2,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_2_QUERY,
  },
  {
    label: 'Server 3',
    base: process.env.NEXT_PUBLIC_STREAM_SOURCE_3,
    query: process.env.NEXT_PUBLIC_STREAM_SOURCE_3_QUERY,
  },
]

/**
 * What every visitor gets without choosing. Free visitors only ever get this
 * one entry, so it must be a working embed — the self-host Reely Player is
 * intentionally off the list (its provider binds each playlist token to the
 * resolving IP, so a server-resolved stream is unplayable in the browser).
 */
const DEFAULT_LABEL = 'Server 1'

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
    built.push({
      id,
      label: slot.label,
      base: trimmed,
      ...(slot.query?.trim() ? { query: slot.query.trim() } : {}),
    })
  }

  // Lead with the default so it is position 0 — free visitors get only the
  // first entry, and everyone starts here. Stable sort keeps the rest in slot
  // order.
  built.sort(
    (a, b) =>
      Number(b.label === DEFAULT_LABEL) - Number(a.label === DEFAULT_LABEL)
  )

  return built
}

export const STREAM_SOURCES: StreamSource[] = buildSources()

export const DEFAULT_SOURCE_ID: string = STREAM_SOURCES[0]?.id ?? ''

/** True only when there is somewhere else to go. The UI hides itself otherwise. */
export const HAS_FALLBACK_SOURCE = STREAM_SOURCES.length > 1

/**
 * The opt-in surface for supporters: OUR OWN player, back in testing.
 *
 * Enabled deployment-wide by NEXT_PUBLIC_PRO_TRIAL_SELFHOST=true — it needs
 * the playback worker plus a gado-proxy tier behind it (see the
 * reely-resolver-relay repo) to serve bytes, since no provider hands out
 * origin-open segments. Deliberately NOT part of STREAM_SOURCES: it does not
 * exist for anyone who has not switched it on from their account, so the
 * default journey is untouched down to the URL.
 */
const SELFHOST_TRIAL = process.env.NEXT_PUBLIC_PRO_TRIAL_SELFHOST === 'true'

export const RICH_SOURCE: StreamSource | null = SELFHOST_TRIAL
  ? { id: REELY_SOURCE_ID, label: 'Reely Beta' }
  : null

/**
 * The list a given visitor may choose between. Everyone gets STREAM_SOURCES;
 * a supporter who opted in also gets the rich surface, offered first because
 * it is the one they asked to try. Callers must treat the result as the
 * validation set for stored source ids — an id remembered while opted in has
 * to resolve to nothing once opted out.
 */
export const visibleSourcesFor = (richOptedIn: boolean): StreamSource[] =>
  richOptedIn && RICH_SOURCE ? [RICH_SOURCE, ...STREAM_SOURCES] : STREAM_SOURCES

export const sourceById = (id: string | null | undefined): StreamSource =>
  STREAM_SOURCES.find((source) => source.id === id) ?? STREAM_SOURCES[0]

/** The film URL. Every provider on the list takes this shape. */
export const movieStreamUrl = (source: StreamSource, id: number): string =>
  withSourceQuery(`${source.base}/movie/${id}`, source)

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
  const url = target ? `${base}/${target.season}/${target.episode}` : base
  return withSourceQuery(url, source)
}

/** Append the slot's configured query, if any. Never touches signed params. */
const withSourceQuery = (url: string, source: StreamSource): string =>
  source.query ? `${url}${url.includes('?') ? '&' : '?'}${source.query}` : url
