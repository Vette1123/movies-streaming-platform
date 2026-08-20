import { ALERT_REGION_IDS, regionLabel } from '@/config/regions'
import { listSentence } from '@/lib/utils'

/**
 * "Now streaming on X" — the pure half.
 *
 * Everything here is a function of a TMDB payload and the last thing we said,
 * with no database and no clock beyond what is passed in, because the failure
 * this code can cause is a notification storm: get the comparison wrong and
 * every supporter with a watchlist is told about every title on it, once an
 * hour, forever. That is the kind of bug worth testing exhaustively and the
 * reason this is not inline in sweep.ts.
 *
 * The subrequest budget is why the shape is what it is. The sweep already
 * fetches each title once; adding `watch/providers` to that call's
 * `append_to_response` costs nothing extra, which is the only reason this
 * feature can exist at all inside the 50-subrequests-per-invocation cap.
 */

/** One provider as TMDB reports it. */
interface TmdbProvider {
  provider_name?: string
}

interface TmdbRegionProviders {
  /** Subscription. The only kind that counts here. */
  flatrate?: TmdbProvider[] | null
  /** Free with ads, which is still "you can watch it now". */
  free?: TmdbProvider[] | null
  /** Deliberately unread: rent and buy were always available. */
  rent?: TmdbProvider[] | null
  buy?: TmdbProvider[] | null
}

export interface TmdbWatchProviders {
  results?: Record<string, TmdbRegionProviders> | null
}

/** `{ US: 'Max|Netflix' }` — see migrations/0004 for why it is a string. */
export type ProviderMap = Record<string, string>

/**
 * The services somebody with a subscription could start watching on, right now.
 *
 * Rent and buy are excluded on purpose. A film has been rentable on five stores
 * since release, so including them would make every title permanently
 * "available" and the alert would never mean anything. What people want to hear
 * is that a title has landed on something they already pay for.
 */
const namesFor = (region: TmdbRegionProviders | undefined): string => {
  if (!region) return ''
  const names = [...(region.flatrate ?? []), ...(region.free ?? [])]
    .map((item) => item.provider_name?.trim())
    .filter((name): name is string => Boolean(name))
  // Sorted and de-duplicated so the string is a stable signature: TMDB does not
  // promise an order, and an unsorted join would "change" every sweep and
  // announce the same thing forever.
  return [...new Set(names)].sort().join('|')
}

/**
 * The regions we keep, and only those. See config/regions.ts — TMDB answers
 * with every country it knows, and storing all of them would put a kilobyte of
 * JSON on every row to serve the handful anybody chose.
 */
export function providerMap(payload: TmdbWatchProviders | null): ProviderMap {
  const results = payload?.results
  if (!results) return {}
  const out: ProviderMap = {}
  for (const region of ALERT_REGION_IDS) {
    const names = namesFor(results[region])
    if (names) out[region] = names
  }
  return out
}

/** Parse what the column holds, tolerating the null and the malformed. */
export function parseProviderMap(raw: string | null | undefined): ProviderMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    const out: ProviderMap = {}
    for (const [region, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value) out[region] = value
    }
    return out
  } catch {
    return {}
  }
}

const split = (value: string | undefined): string[] =>
  value ? value.split('|').filter(Boolean) : []

/**
 * What is newly watchable in each region, given what was last announced.
 *
 * Additions only. A title LEAVING a service is a real event and deliberately
 * not one this notifies about: "it is gone" is bad news nobody asked to be
 * woken for, and it would double the volume of a feature whose whole appeal is
 * that it is quiet.
 *
 * The empty-previous case is the one that matters. A row whose
 * `providers_notified` is null has never been announced, and treating that as
 * "everything is new" would fire the entire backlog of every watchlist the
 * first time this ships. So a first sighting records the state and stays
 * silent; only a change from a KNOWN state announces.
 */
export function newProviders(
  current: ProviderMap,
  announced: ProviderMap,
  { firstSightingIsSilent = true } = {}
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [region, names] of Object.entries(current)) {
    const previous = announced[region]
    if (previous === undefined && firstSightingIsSilent) continue
    const before = new Set(split(previous))
    const fresh = split(names).filter((name) => !before.has(name))
    if (fresh.length > 0) out[region] = fresh
  }
  return out
}

/**
 * Merge what was announced with what is now known.
 *
 * Every region present in `current` is recorded, including the ones that
 * announced nothing — that is what makes the NEXT change measurable, and what
 * makes a first sighting silent exactly once rather than on every tick.
 * Regions absent from `current` keep their old entry: TMDB omitting a country
 * for one response is not evidence a title left it.
 */
export function mergeAnnounced(
  announced: ProviderMap,
  current: ProviderMap
): ProviderMap {
  return { ...announced, ...current }
}

/** The sentence a person reads on their phone. */
export function providerAnnouncement(
  title: string,
  names: string[],
  region: string
): { title: string; body: string } {
  const list = listSentence(names)
  return {
    title: `${title} is streaming`,
    body: `Now on ${list} in ${regionLabel(region)}.`,
  }
}
