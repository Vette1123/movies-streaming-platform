/**
 * The browser half of the Managed Challenge (scripts/lib/challenge.mjs).
 *
 * The public APIs answer a challenge first. A visitor who landed on a static
 * page (home, a genre hub) has not passed one yet, so their first search comes
 * back as a challenge page with `cf-mitigated: challenge`, which a fetch cannot
 * solve. They make one top-level hop through /api/verify instead: Cloudflare
 * challenges the navigation, the browser solves it (usually without a click),
 * and the Worker sends them straight back with a pass that lasts a day.
 */

/** Kept in sync with CHALLENGE_HOP_PATH in scripts/lib/challenge.mjs. */
export const CHALLENGE_HOP_PATH = '/api/verify'

const HOP_KEY = 'reely:challenge-hop'

/** A browser that cannot keep the cookie would hop forever; once per 2 min. */
export const HOP_COOLDOWN_MS = 2 * 60 * 1000

/** A same-site path only: never `//evil.example` or `/\evil.example`. */
export function safeReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return '/'
  if (next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}

export function hopUrl(location: {
  pathname: string
  search: string
  hash: string
}): string {
  const back = `${location.pathname}${location.search}${location.hash}`
  return `${CHALLENGE_HOP_PATH}?next=${encodeURIComponent(back)}`
}

export function mayHop(lastHopAt: number | null, now: number): boolean {
  return lastHopAt === null || now - lastHopAt > HOP_COOLDOWN_MS
}

/** A challenged answer from one of our own APIs. */
export function isChallengedApi(
  status: number,
  mitigated: string | null,
  url: string,
  origin: string
): boolean {
  if (status !== 403 || mitigated !== 'challenge') return false
  const target = new URL(url, origin)
  return target.origin === origin && target.pathname.startsWith('/api/')
}

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function readLastHop(): number | null {
  try {
    const raw = window.sessionStorage.getItem(HOP_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeLastHop(now: number) {
  try {
    window.sessionStorage.setItem(HOP_KEY, String(now))
  } catch {
    // Storage blocked: the hop still happens, only the loop guard is lost.
  }
}

/**
 * Wraps window.fetch once, so every caller (api-client, hooks with raw fetch,
 * React Query) gets the hop without knowing about it.
 */
export function installChallengeHop() {
  const w = window as Window & { __reelyChallengeHop?: boolean }
  if (w.__reelyChallengeHop) return
  w.__reelyChallengeHop = true
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const res = await original(input, init)
    if (
      isChallengedApi(
        res.status,
        res.headers.get('cf-mitigated'),
        requestUrl(input),
        window.location.origin
      )
    ) {
      const now = Date.now()
      if (mayHop(readLastHop(), now)) {
        writeLastHop(now)
        window.location.assign(hopUrl(window.location))
      }
    }
    return res
  }
}
