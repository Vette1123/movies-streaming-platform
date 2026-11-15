/**
 * Is this title in the own-library media plane (tier 0)?
 *
 * The player answers "can I play this" per title (its availability route), but
 * the site must decide BEFORE anybody presses play: while the relay is shut
 * out (2026-11-13 and again 2026-11-15), the switcher still has to offer the
 * player for a title we host ourselves, because tier 0 carries no relay hop.
 * The relay's /selftest can never answer that - it only knows the provider.
 *
 * So the Worker reads the same catalog file the player reads. The file lives
 * on the media plane (LIBRARY_HOST), one small JSON keyed by title. Unset
 * LIBRARY_HOST or LIBRARY_CATALOG_PATH and tier 0 is invisible here, exactly
 * as it is in the player ("unset either one and tier 0 silently disappears").
 *
 * The catalog file's NAME is the obscurity boundary: it rides a wrangler
 * secret (LIBRARY_CATALOG_PATH, uploaded by the deploy workflow's manual
 * secrets step), never a var and never the client bundle.
 */

/**
 * One answer stands this long per Cloudflare colo - the same TTL the relay
 * health answer lives by, so a title ingested a minute ago is offered at most
 * five minutes late.
 */
export const LIBRARY_CATALOG_TTL_S = 300

/** The query the health route parses. Null for the bare relay question. */
export interface HealthTarget {
  type: 'movie' | 'tv'
  id: number
}

export const healthTargetOf = (
  ty: string | null,
  id: string | null
): HealthTarget | null => {
  const num = Number(id)
  if ((ty !== 'movie' && ty !== 'tv') || !Number.isInteger(num) || num <= 0)
    return null
  return { type: ty, id: num }
}

/**
 * Membership. A movie is exact; a show is its episodes (`tv:1399:...`), which
 * is the trial budget's own rule (ticket-access: "episodes of a show are one
 * title"). A missing episode is not a refusal: the player answers its own
 * `stream: false` for it and the client releases the trial - the same path a
 * provider-bound title with no stream already walks.
 */
export const catalogHas = (
  catalog: unknown,
  type: 'movie' | 'tv',
  id: number
): boolean => {
  const titles = (catalog as { titles?: Record<string, unknown> } | null)
    ?.titles
  if (!titles || typeof titles !== 'object') return false
  if (type === 'movie')
    return Object.prototype.hasOwnProperty.call(titles, `movie:${id}`)
  const prefix = `tv:${id}:`
  return Object.keys(titles).some((key) => key.startsWith(prefix))
}

/**
 * Fetch the catalog. Never throws: an unreachable plane reads as "not in the
 * library", which is the safe answer - the player's own tier-0 lookup is the
 * authority that decides a play, and it fails the same way.
 */
export const fetchLibraryCatalog = async (
  host: string | undefined,
  path: string | undefined,
  fetcher: typeof fetch = fetch
): Promise<unknown> => {
  if (!host || !path) return {}
  try {
    const root = host.trim().replace(/\/$/, '')
    const res = await fetcher(`${root}/${path}`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}
