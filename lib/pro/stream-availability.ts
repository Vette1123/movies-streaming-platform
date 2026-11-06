/**
 * Ask the player worker whether the provider carries a title at all.
 *
 * The worker asks the relay's own resolve, the walk playback uses, and answers
 * `stream: true | false | null`. Only a definite `false` counts as "no stream":
 * this decides whether a free visitor gets their daily trial back, so a timeout,
 * a rate limit or an unknown shape keeps it spent (releaseTrial in
 * ticket-access.ts). The ticket is minted here, server-side, for this one call:
 * the player's read routes accept a 90-second entry ticket.
 */

import { signEntryTicket, type PlaybackTarget } from '@/lib/pro/playback-ticket'

export async function providerHasNoStream(
  base: string | undefined,
  secret: string | undefined,
  target: PlaybackTarget,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  const root = base?.trim().replace(/\/$/, '')
  if (!root) return false
  try {
    // Inside the try: a malformed secret throws, and that must keep the trial
    // spent, not 500 the route.
    const ticket = await signEntryTicket(secret, target)
    if (!ticket) return false
    const params = new URLSearchParams({
      type: target.type,
      id: String(target.id),
      t: ticket,
    })
    if (target.type === 'tv') {
      params.set('season', String(target.season ?? 1))
      params.set('episode', String(target.episode ?? 1))
    }
    const res = await fetcher(`${root}/api/stream/availability?${params}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { stream?: unknown }
    return data?.stream === false
  } catch {
    return false
  }
}
