// Which $exception events never reach Error Tracking.
//
// Split out of providers/posthog-provider.tsx so the verdict is a pure function
// over an event object: it decides whether a real, fixable regression is visible
// or buried, and every rule in it was added because something unfixable was
// drowning the dashboard. tests/error-noise.test.ts pins it.

import type { CaptureResult } from 'posthog-js'

import {
  isStaleChunkError,
  isStaleDeployError,
  isTransportError,
} from '@/lib/client-errors'

/**
 * Unactionable $exception classes that flood error tracking with noise we can
 * never fix in app code:
 *
 * - React #418: a hydration mismatch. Overwhelmingly caused by browser
 *   extensions (Grammarly, translators, password managers) mutating the DOM
 *   before hydration — our components are all mount-gated / hydration-safe.
 * - "Script error.": a cross-origin script threw with no CORS header, so the
 *   browser gives us zero detail. Always third-party / extension code.
 * - removeChild on Node: an extension removed a node out from under React's
 *   reconciler. Not our tree. All three engines word it differently.
 * - null 'document': fired from an injected `HTMLDocument.c` frame (not our
 *   source) — extension/bookmarklet code, never our bundle.
 * - ResizeObserver loop: the spec says a browser MAY report an undelivered
 *   resize notification; it's a benign frame-budget warning, not a failure —
 *   nothing observable breaks and no app code can prevent it.
 * - _internal_videoInjector*: a video-downloader extension's page script poking
 *   at a <video> it thinks exists. Not a symbol our bundle ever defines.
 * - "Hydration failed because…": the unminified twin of #418, same cause.
 * - `standardSelectors`: Brave's Shields cosmetic-filtering content script (the
 *   symbol is brave-core's, appears in no dependency of ours) throwing inside
 *   its own injected code on iOS. Arrives synthetic, unhandled, with zero stack
 *   frames from our bundle, and nothing on the page is actually broken.
 * - `<something>.data.split is not a function`: a `message` event handler that
 *   assumed a string payload got an object instead. We register no message
 *   listener anywhere (the YouTube embed is postMessage-out only), and these
 *   arrive with zero stack frames from our bundle — it's injected page script.
 */
const NOISE_EXCEPTION_PATTERNS = [
  /Minified React error #418\b/i,
  /react\.dev\/errors\/418\b/i,
  /Hydration failed because the server rendered HTML didn't match/i,
  /^\s*Script error\.?\s*$/i,
  /Failed to execute 'removeChild' on 'Node'/i,
  // The same removeChild collision in the other two engines. WebKit words it as
  // a bare DOMException naming no node at all, which is how it reached Error
  // Tracking from an iOS session while the Chromium pattern matched nothing.
  /NotFoundError: The object can not be found here/i,
  /The node to be removed is not a child of this node/i,
  /Cannot read properties of null \(reading 'document'\)/i,
  /ResizeObserver loop/i,
  /_internal_videoInjector/i,
  /\bstandardSelectors\b/,
  /\bdata\.split is not a function/i,
]

interface ExceptionFrame {
  filename?: unknown
}

interface ExceptionItem {
  type?: unknown
  value?: unknown
  stacktrace?: { frames?: unknown }
}

/** Collect every exception type/value string carried on a $exception event. */
export function exceptionStrings(event: CaptureResult): string[] {
  const props = (event.properties ?? {}) as Record<string, unknown>
  const out: string[] = []
  const list = props.$exception_list
  if (Array.isArray(list)) {
    for (const ex of list as ExceptionItem[]) {
      if (ex && typeof ex.value === 'string') out.push(ex.value)
      if (ex && typeof ex.type === 'string') out.push(ex.type)
    }
  }
  const values = props.$exception_values
  if (Array.isArray(values)) {
    for (const v of values) if (typeof v === 'string') out.push(v)
  }
  return out
}

/** True when an exception is a known-unactionable extension / cross-origin noise. */
function isNoiseException(messages: string[]): boolean {
  return messages.some((m) => NOISE_EXCEPTION_PATTERNS.some((re) => re.test(m)))
}

// Every script this app ships is served from /_next/ — the static export puts
// nothing executable anywhere else, and the single inline script in <head> is a
// one-line try/catch that defines no functions (see APPEARANCE_BOOT_SCRIPT).
const OWN_FRAME = /\/_next\//

/**
 * True when an exception carries a stack in which NOT ONE frame is ours.
 *
 * The general form of half the named patterns above: code injected into the page
 * — an extension's content script, a translator's `eval`, a bookmarklet — threw,
 * and the page kept working. On iOS such a stack is attributed to the DOCUMENT
 * url (`https://www.reely.space/tv-shows:224:408`), so it arrives looking in-app
 * while naming a file that ships no JavaScript of ours; that is how a
 * "Maximum call stack size exceeded" between two mutually recursive functions we
 * do not define landed in Error Tracking.
 *
 * A stack with no filenames at all is KEPT: a cross-origin "Script error." looks
 * like that, and so does a `captureException` in a browser that gave us nothing.
 * Only a stack that names files, none of them ours, is foreign.
 */
function isForeignException(event: CaptureResult): boolean {
  const props = (event.properties ?? {}) as Record<string, unknown>
  const list = props.$exception_list
  if (!Array.isArray(list)) return false
  let sawFrame = false
  for (const ex of list as ExceptionItem[]) {
    const frames = ex?.stacktrace?.frames
    if (!Array.isArray(frames)) continue
    for (const frame of frames as ExceptionFrame[]) {
      if (typeof frame?.filename !== 'string') continue
      if (OWN_FRAME.test(frame.filename)) return false
      sawFrame = true
    }
  }
  return sawFrame
}

/**
 * Stale-bundle and transport failures reach Error Tracking by a second route:
 * PostHog autocaptures them as unhandled window errors / rejections, which never
 * pass through the react-query reporter that already classifies them as expected
 * (providers/query-provider.tsx). They aren't code faults — a tab that outlived
 * one of our ~4x/day deploys, or a connection that dropped — and the same event
 * already triggers reloadForStaleDeploy() to recover the user. Drop them so the
 * dashboard keeps showing only errors we can actually fix.
 */
function isUnactionableFailure(messages: string[]): boolean {
  return messages.some(
    (m) => isStaleDeployError(m) || isStaleChunkError(m) || isTransportError(m)
  )
}

/** The whole verdict: true when this $exception must not be reported. */
export function shouldDropException(event: CaptureResult): boolean {
  const messages = exceptionStrings(event)
  return (
    isNoiseException(messages) ||
    isUnactionableFailure(messages) ||
    isForeignException(event)
  )
}
