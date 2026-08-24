'use client'

import {
  playbackKey,
  readPosition,
  resumableSeconds,
} from '@/lib/playback-positions'
import { readPlaybackPrefs } from '@/lib/playback-prefs'
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
 */
const TICKET_FRESH_MS = 45000

const tickets = new Map<string, { at: number; url: Promise<string | null> }>()

const ticketKey = (target: SelfHostTarget) =>
  `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

const mintTicket = async (target: SelfHostTarget): Promise<string | null> => {
  const start = resumableSeconds(
    readPosition(
      playbackKey(target.type, target.id, target.season, target.episode)
    )
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
      // Applied by the player on boot; read synchronously from the local
      // mirror so no account round trip delays first play.
      playback: readPlaybackPrefs(),
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

/** The play URL for this title, minting one only when nothing fresh is held. */
export const ticketFor = (target: SelfHostTarget): Promise<string | null> => {
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
    .catch(() => tickets.delete(key))
  return url
}

/**
 * Pay for the ticket while the visitor is still deciding. Safe to call on every
 * pointer intent: a fresh entry is reused, and a failure is swallowed — the
 * player's own mount does the real attempt and owns the fallback.
 */
export const warmReelyTicket = (target: SelfHostTarget): void => {
  void ticketFor(target).catch(() => undefined)
}

/** Test seam: the module-level cache is shared by every caller in the tab. */
export const __clearTicketCache = () => tickets.clear()
