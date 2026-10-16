'use client'

import { startSecondsFor } from '@/lib/playback-positions'
import { currentPlaybackPrefs } from '@/lib/playback-prefs'
import { type SelfHostTarget } from '@/lib/stream-resolver'

/**
 * One play URL per title, warmed on intent.
 *
 * Pressing play used to start the whole chain cold: mint a ticket (a round trip
 * to our Worker), then load the player shell, then its bundle, then the stream
 * lookup. The ticket is the only link in that chain that can be paid for BEFORE
 * the tap — hovering or touching the play control is enough — so it is cached
 * here by title and reused by the player when it mounts.
 *
 * Entry tickets live ~90 seconds. A warm entry is dropped well before that, or
 * a visitor who hesitated would be handed an expired one and told their session
 * had expired.
 *
 * A held ticket is SPENT by the player that boots from it. Its URL carries the
 * start position and the subtitle choice as they were at mint time, so handing
 * the same one to a second mount (the settings gear remounts the player) came
 * back on the old subtitles and restarted the episode from wherever the first
 * boot began.
 */
const TICKET_FRESH_MS = 45000

const tickets = new Map<string, { at: number; url: Promise<string | null> }>()

const ticketKey = (target: SelfHostTarget) =>
  `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

const mintTicket = async (target: SelfHostTarget): Promise<string | null> => {
  const start = startSecondsFor(
    target.type,
    target.id,
    target.season,
    target.episode
  )
  const res = await fetch('/api/pro/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: target.type,
      id: target.id,
      ...(target.type === 'tv'
        ? { season: target.season ?? 1, episode: target.episode ?? 1 }
        : {}),
      title: target.title ?? '',
      ...(target.year ? { year: target.year } : {}),
      ...(target.imdb ? { imdb: target.imdb } : {}),
      start,
      // Applied by the player on boot; read synchronously (account store,
      // then the local mirror) so no round trip delays first play.
      playback: currentPlaybackPrefs(),
    }),
  })
  if (!res.ok) throw new Error(`ticket ${res.status}`)
  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('no url')
  return data.url
}

/**
 * Open the connection to the player origin the moment a ticket names it.
 *
 * The player lives on its own worker, so the iframe's first byte costs a DNS
 * lookup, a TCP handshake and a TLS negotiation that no earlier request on the
 * page has paid for. Warming happens on intent, which is typically a second or
 * more before the tap — long enough for all three to finish off the clock.
 */
const preconnected = new Set<string>()

const preconnect = (url: string) => {
  if (typeof document === 'undefined') return
  let origin = ''
  try {
    origin = new URL(url).origin
  } catch {
    return
  }
  if (origin === location.origin || preconnected.has(origin)) return
  preconnected.add(origin)
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = origin
  // The iframe navigation is a document request, not a credentialed subresource
  // fetch, so the anonymous socket is the one it will actually reuse.
  link.crossOrigin = ''
  document.head.appendChild(link)
}

/**
 * The player's own stream lookup for a ticket, or null for a URL that does not
 * name a title.
 *
 * Built from the ticket URL because that is the one place the player origin
 * and the signed ticket both live; the coordinates are copied, never invented,
 * so the lookup cannot drift from what the player will ask for.
 */
export const resolveUrlOf = (ticketUrl: string): string | null => {
  let play: URL
  try {
    play = new URL(ticketUrl)
  } catch {
    return null
  }
  const q = play.searchParams
  const ticket = q.get('t')
  const type = q.get('type')
  const id = q.get('id')
  if (!ticket || !type || !id) return null
  const lookup = new URLSearchParams({ type, id })
  if (type === 'tv') {
    lookup.set('season', q.get('season') ?? '1')
    lookup.set('episode', q.get('episode') ?? '1')
  }
  lookup.set('t', ticket)
  return `${play.origin}/api/stream/resolve?${lookup}`
}

/**
 * Start the stream lookup while the visitor is still deciding.
 *
 * A title nobody has played in the last hour costs the relay a full provider
 * walk (~1.2s measured 2026-10-16), and it used to start only after the tap,
 * the iframe, the shell and the bundle. Asked here, on intent, the relay is
 * already walking — or done, and caching it — by the time the player asks the
 * same question; it shares an in-flight walk rather than starting a second.
 *
 * `no-cors` because the answer is not ours to read: the point is the side
 * effect in the relay's cache, and an opaque request needs no CORS from the
 * player origin. A failure is swallowed: the player's own lookup is the real
 * attempt and owns the fallback.
 */
const prewalk = (ticketUrl: string) => {
  const lookup = resolveUrlOf(ticketUrl)
  if (!lookup) return
  void fetch(lookup, { mode: 'no-cors', credentials: 'omit' }).catch(
    () => undefined
  )
}

const isFresh = (key: string) => {
  const warm = tickets.get(key)
  return !!warm && Date.now() - warm.at < TICKET_FRESH_MS
}

/** The play URL for this title, minting one only when nothing fresh is held. */
const heldTicket = (target: SelfHostTarget): Promise<string | null> => {
  const key = ticketKey(target)
  const warm = tickets.get(key)
  if (warm && Date.now() - warm.at < TICKET_FRESH_MS) return warm.url
  const url = mintTicket(target)
  tickets.set(key, { at: Date.now(), url })
  // One chain for both side effects: open the socket the ticket names, and —
  // because a rejected promise left in the map is re-thrown at every later
  // caller — drop the entry so the next real attempt can try again.
  void url
    .then((minted) => {
      if (minted) preconnect(minted)
    })
    .catch(() => {
      // Only if it is still ours: a newer warm may have replaced it.
      if (tickets.get(key)?.url === url) tickets.delete(key)
    })
  return url
}

/** For the player's mount: the warm ticket when one is held, and it is spent. */
export const takeTicket = (target: SelfHostTarget): Promise<string | null> => {
  const url = heldTicket(target)
  tickets.delete(ticketKey(target))
  return url
}

/**
 * Pay for the ticket — and the stream lookup behind it — while the visitor is
 * still deciding. Safe to call on every pointer intent: a fresh entry is reused
 * and walks nothing again, and a failure is swallowed — the player's own mount
 * does the real attempt and owns the fallback.
 */
export const warmReelyTicket = (target: SelfHostTarget): void => {
  const minted = !isFresh(ticketKey(target))
  const url = heldTicket(target)
  void url
    .then((ticketUrl) => {
      if (minted && ticketUrl) prewalk(ticketUrl)
    })
    .catch(() => undefined)
}

/** Forget every warm ticket — a playback setting changed under them. */
export const dropWarmTickets = () => tickets.clear()
