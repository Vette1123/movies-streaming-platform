// Does any stream server merely wrap an earlier one?
//
// 2026-11-11: server 1's player host went down, and the one automatic hop
// after a stall (rescueSourcesFor, hooks/use-stream-source.ts) went to server
// 2 — whose embed page is an iframe of server 1. Every rescue landed on the
// same dead player. Slot order is the rescue order, so a slot that wraps an
// earlier slot is worse than useless right after it.

const bare = (host) => host.toLowerCase().replace(/^www\./, '')

/** Hosts a page frames: iframe `src`, or a lazy `data-src`; about:blank skipped. */
export function embeddedHosts(html) {
  const hosts = []
  for (const tag of html.match(/<iframe\b[^>]*>/gi) ?? []) {
    for (const m of tag.matchAll(/\b(?:data-)?src="(https?:\/\/[^"]+)"/gi)) {
      const host = new URL(m[1]).host
      if (!hosts.includes(host)) hosts.push(host)
    }
  }
  return hosts
}

/** `[{slot, host, embeds}]` → the slots that frame an EARLIER slot's host. */
export function wrappedSlots(slots) {
  const found = []
  slots.forEach((entry, index) => {
    const embeds = entry.embeds.map(bare)
    const earlier = slots
      .slice(0, index)
      .find((prior) => embeds.includes(bare(prior.host)))
    if (earlier) found.push({ slot: entry.slot, wraps: earlier.slot })
  })
  return found
}
