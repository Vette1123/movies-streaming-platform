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

/** Where the pass lands: a static file, so it costs no invocation. */
export const SILENT_PASS_LANDING = '/robots.txt'

/**
 * How long the check stays hidden. Non-interactive solves measured 4-7s on
 * production (Cloudflare firewall events, 2026-11-20); past this the check is
 * either slow or wants a click, and a hidden frame can take neither.
 */
export const SILENT_PASS_TIMEOUT_MS = 10_000

/**
 * How long the check stays on screen once shown. Long enough to read it and
 * tick the box; after that the visible hop is the last resort.
 */
export const SHOWN_CHECK_TIMEOUT_MS = 60_000

/** How the pass ended, for the caller's analytics. Counts only. */
export interface PassOutcome {
  how: 'hidden' | 'shown' | 'hop' | 'dismissed'
  ok: boolean
  ms: number
}

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

const HIDDEN_STYLE =
  'position:fixed;left:-10000px;top:0;width:360px;height:360px;opacity:0;pointer-events:none'

// The visible card. Centred (a modal, not anchored to a trigger), sized to
// Cloudflare's widget, never wider than the screen.
const SHOWN_STYLE =
  'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;background:rgb(0 0 0 / 0.6)'

const CARD_STYLE =
  'width:min(360px,100%);border-radius:16px;overflow:hidden;background:#0b0b0f;color:#f4f4f5;box-shadow:0 24px 64px rgb(0 0 0 / 0.5);font:14px/1.45 system-ui,sans-serif'

let pending: Promise<boolean> | null = null

/**
 * Solves the challenge in a same-origin frame, so the page never moves.
 *
 * 2026-11-20: 2 of 7 visible hops were abandoned (Back before the solve).
 * 2026-11-22: the hidden frame alone solved for 5 of 15 IPs in a day. The
 * rest timed out and hopped, and BR/MM/NG visitors never came back. So the
 * frame starts hidden and, if it has not landed in SILENT_PASS_TIMEOUT_MS,
 * the SAME frame is shown in place, where a click is possible. The frame is
 * never moved in the DOM (that reloads an iframe); only its wrapper's style
 * changes. One check at a time, shared by every fetch challenged meanwhile.
 */
function solveInPlace(report: (o: PassOutcome) => void): Promise<boolean> {
  if (pending) return pending
  const started = Date.now()
  pending = new Promise<boolean>((resolve) => {
    const wrap = document.createElement('div')
    wrap.setAttribute('aria-hidden', 'true')
    wrap.style.cssText = HIDDEN_STYLE
    const card = document.createElement('div')
    card.style.cssText = 'width:100%;height:100%'
    const frame = document.createElement('iframe')
    frame.title = 'Security check'
    frame.tabIndex = -1
    frame.style.cssText = 'display:block;width:100%;height:300px;border:0'
    card.appendChild(frame)
    wrap.appendChild(card)

    let shown = false
    let timer = setTimeout(() => show(), SILENT_PASS_TIMEOUT_MS)
    const finish = (ok: boolean, how: PassOutcome['how']) => {
      clearTimeout(timer)
      wrap.remove()
      pending = null
      report({ how, ok, ms: Date.now() - started })
      resolve(ok)
    }

    function show() {
      shown = true
      wrap.removeAttribute('aria-hidden')
      wrap.setAttribute('role', 'dialog')
      wrap.setAttribute('aria-modal', 'true')
      wrap.setAttribute('aria-label', 'Quick security check')
      wrap.style.cssText = SHOWN_STYLE
      card.style.cssText = CARD_STYLE
      frame.tabIndex = 0
      const note = document.createElement('p')
      note.textContent =
        'Quick check before we load this. It keeps Reely free and fast.'
      note.style.cssText = 'margin:0;padding:16px 16px 8px'
      card.insertBefore(note, frame)
      const later = document.createElement('button')
      later.type = 'button'
      later.textContent = 'Not now'
      later.style.cssText =
        'display:block;width:100%;padding:12px;border:0;border-top:1px solid rgb(255 255 255 / 0.1);background:transparent;color:inherit;font:inherit;cursor:pointer'
      later.onclick = () => finish(false, 'dismissed')
      card.appendChild(later)
      const reduce = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches
      card.animate?.(
        reduce
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: 'scale(0.96)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
        { duration: 200, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      )
      frame.focus?.()
      timer = setTimeout(() => finish(false, 'shown'), SHOWN_CHECK_TIMEOUT_MS)
    }

    frame.onload = () => {
      try {
        if (frame.contentWindow?.location.pathname === SILENT_PASS_LANDING) {
          finish(true, shown ? 'shown' : 'hidden')
        }
      } catch {
        // Not readable yet: the challenge page is still in charge.
      }
    }
    frame.src = `${CHALLENGE_HOP_PATH}?next=${encodeURIComponent(SILENT_PASS_LANDING)}`
    document.body.appendChild(wrap)
  })
  return pending
}

function hopVisibly(report: (o: PassOutcome) => void) {
  const now = Date.now()
  if (!mayHop(readLastHop(), now)) return
  writeLastHop(now)
  report({ how: 'hop', ok: true, ms: 0 })
  window.location.assign(hopUrl(window.location))
}

/**
 * Wraps window.fetch once, so every caller (api-client, hooks with raw fetch,
 * React Query) gets the pass without knowing about it: a challenged answer is
 * solved in a frame (hidden, then shown) and the request sent again. Only when
 * that fails without the visitor saying "Not now" does the page hop.
 */
export function installChallengeHop(
  report: (o: PassOutcome) => void = () => {}
) {
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
  let dismissed = false
  window.fetch = async (input, init) => {
    const res = await original(input, init)
    if (!challenged(res, input) || dismissed) return res
    if (isReplayable(input, init)) {
      const passed = await solveInPlace((o) => {
        if (o.how === 'dismissed') dismissed = true
        report(o)
      })
      if (passed) {
        const retry = await original(input, init)
        if (!challenged(retry, input)) return retry
      }
    }
    if (!dismissed) hopVisibly(report)
    return res
  }
}
