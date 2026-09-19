/**
 * Titles whose playback has been disabled following a copyright notice.
 *
 * `config/blocked-titles.json` is the list; this is the only thing that reads
 * it, so the two enforcers cannot drift:
 *
 *   - `cloudflare/worker.js` refuses to mint a playback ticket, which stops the
 *     house player. Client-side gating alone would not: a ticket is a signed
 *     grant, and anyone who can POST for one can play without ever loading our
 *     UI. The server has to be the one that says no.
 *   - The detail heroes refuse to mount any player, which stops every
 *     third-party embed, because an embed is just an iframe `src` the client
 *     chooses and the server never sees.
 *
 * Neither half is sufficient alone and both are cheap, so both do it.
 *
 * The site's own disclaimer promises to "promptly remove or disable access to
 * any infringing content upon receipt of proper notification". This is the
 * machinery that makes that sentence true in minutes rather than whenever
 * somebody gets round to a deploy — and "expeditious" is the word that decides
 * whether a host keeps its safe harbour, so the speed is the substance.
 *
 * What is NOT removed is the page. The synopsis, cast, artwork, ratings and
 * links are TMDB metadata shown under TMDB's terms, they are what the search
 * engines have indexed, and a notice about a stream is not a notice about a
 * filmography. Only playback goes.
 */
import blocked from '@/config/blocked-titles.json'

export type BlockedMediaType = 'movie' | 'tv'

export interface BlockedTitle {
  type: BlockedMediaType
  id: number
  title: string
  /** ISO date the notice arrived. */
  reportedOn: string
  /** The sender's own reference, so a reply can cite it. */
  reportId: string
  complainant: string
  via?: string
}

export const BLOCKED_TITLES: BlockedTitle[] = (blocked.titles ??
  []) as BlockedTitle[]

/**
 * Keyed lookup built once. The list is small today and this is on the path of
 * every detail render and every ticket mint, so it should stay O(1) even if a
 * few hundred notices accumulate.
 */
const BLOCKED_KEYS = new Set(
  BLOCKED_TITLES.map((entry) => `${entry.type}:${entry.id}`)
)

/**
 * Is playback disabled for this title?
 *
 * `id` is deliberately loose: it arrives as a route param string on one side
 * and a TMDB number on the other, and a mismatch between `'969681'` and
 * `969681` would silently un-block a title that a copyright holder has been
 * told is blocked. Normalised here, once, rather than at each call site.
 */
export function isTitleBlocked(
  type: BlockedMediaType,
  id: number | string | null | undefined
): boolean {
  if (id === null || id === undefined || id === '') return false
  const numeric = typeof id === 'number' ? id : Number(id)
  if (!Number.isFinite(numeric)) return false
  return BLOCKED_KEYS.has(`${type}:${numeric}`)
}

/** The entry itself, for anything that wants to show or log the reference. */
export function blockedTitleEntry(
  type: BlockedMediaType,
  id: number | string | null | undefined
): BlockedTitle | undefined {
  if (!isTitleBlocked(type, id)) return undefined
  const numeric = typeof id === 'number' ? id : Number(id)
  return BLOCKED_TITLES.find(
    (entry) => entry.type === type && entry.id === numeric
  )
}
