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

/** Where the silent pass lands: a static file, so it costs no invocation. */
export const SILENT_PASS_LANDING = '/robots.txt'

/**
 * Non-interactive solves measured 4-7s on production (Cloudflare firewall
 * events, 2026-11-20). Past this the challenge wants a click, which only the
 * visible hop can offer.
 */
export const SILENT_PASS_TIMEOUT_MS = 10_000

/**
 * A request we can send again unchanged: no body, or a string body. A stream
 * or a consumed Request body cannot be replayed.
 */
export function isReplayable(
  input: RequestInfo | URL,
  init?: RequestInit
): boolean {
  const body = init?.body
  if (body !== undefined && body !== null && typeof body !== 'string') {
    return false
  }
  if (typeof input === 'string' || input instanceof URL) return true
  return input.body === null
}

let silentPass: Promise<boolean> | null = null

/**
 * Solves the challenge in a hidden same-origin frame, so the page never moves.
 *
 * 2026-11-20: 2 of 7 visible hops were abandoned. The visitor saw "Verifying
 * you are human", went Back before the 4-7s solve finished, and the 2-minute
 * cooldown then left search, filters and seasons failing without a word. The
 * frame needs no Back button and no cooldown: a challenge costs no invocation.
 * One frame at a time, shared by every fetch that was challenged meanwhile.
 */
function solveSilently(): Promise<boolean> {
  if (silentPass) return silentPass
  silentPass = new Promise<boolean>((resolve) => {
    const frame = document.createElement('iframe')
    frame.title = 'Security check'
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    // Off screen rather than display:none, so the check still renders and runs.
    frame.style.cssText =
      'position:fixed;left:-10000px;top:0;width:360px;height:360px;border:0;opacity:0;pointer-events:none'
    const finish = (passed: boolean) => {
      clearTimeout(timer)
      frame.remove()
      silentPass = null
      resolve(passed)
    }
    const timer = setTimeout(() => finish(false), SILENT_PASS_TIMEOUT_MS)
    frame.onload = () => {
      try {
        if (frame.contentWindow?.location.pathname === SILENT_PASS_LANDING) {
          finish(true)
        }
      } catch {
        // Not readable yet: the challenge page is still in charge.
      }
    }
    frame.src = `${CHALLENGE_HOP_PATH}?next=${encodeURIComponent(SILENT_PASS_LANDING)}`
    document.body.appendChild(frame)
  })
  return silentPass
}

function hopVisibly() {
  const now = Date.now()
  if (!mayHop(readLastHop(), now)) return
  writeLastHop(now)
  window.location.assign(hopUrl(window.location))
}

/**
 * Wraps window.fetch once, so every caller (api-client, hooks with raw fetch,
 * React Query) gets the pass without knowing about it: a challenged answer is
 * solved in a hidden frame and the request sent again, and only when that
 * fails does the page hop through the visible challenge.
 */
export function installChallengeHop() {
  const w = window as Window & { __reelyChallengeHop?: boolean }
  if (w.__reelyChallengeHop) return
  w.__reelyChallengeHop = true
  const original = window.fetch.bind(window)
  const challenged = (res: Response, input: RequestInfo | URL) =>
    isChallengedApi(
      res.status,
      res.headers.get('cf-mitigated'),
      requestUrl(input),
      window.location.origin
    )
  window.fetch = async (input, init) => {
    const res = await original(input, init)
    if (!challenged(res, input)) return res
    if (isReplayable(input, init) && (await solveSilently())) {
      const retry = await original(input, init)
      if (!challenged(retry, input)) return retry
    }
    hopVisibly()
    return res
  }
}
