// Classification + recovery for client-side failures that are NOT code faults.
//
// Error Tracking was ~75% these: a dropped connection, an offline tab, or a tab
// left open across a deploy. Reporting them as $exceptions buried the real,
// fixable errors, and in the stale-deploy case the user was stuck on a broken
// bundle with no way back. So classify them here, once, and share the verdict
// between the react-query error reporter (providers/query-provider.tsx) and the
// PostHog noise filter.

import { toast } from 'sonner'

// A tab that outlived a deploy (we ship ~4x/day) holds a client bundle whose
// Server Action IDs no longer exist on the origin. The action call comes back
// as a non-RSC response, so TanStack surfaces one of these. The only fix is to
// reload onto the fresh bundle.
const STALE_DEPLOY_SIGNATURES = [
  'An unexpected response was received from the server',
  'was not found on the server',
  'Failed to find Server Action',
]

// Same cause, different symptom: a lazy chunk URL from the old build 404s (or
// the WAF answers it with an HTML challenge page, which the parser then chokes
// on at the leading `<`).
const STALE_CHUNK_SIGNATURES = [
  'ChunkLoadError',
  'Failed to load chunk',
  'Loading chunk',
  'error loading dynamically imported module',
  "Unexpected token '<'",
]

// Transport-level failures: the request never completed, so there is no app
// behaviour to fix. Cross-browser wording for "connection dropped / offline /
// blocked by an extension", plus the two ways an in-flight request dies when
// the user navigates away mid-fetch (`AbortError`) or the Worker cuts the
// Server Action response stream (`Connection closed`).
const TRANSPORT_SIGNATURES = [
  'Failed to fetch', // Chromium
  'Load failed', // Safari
  'NetworkError when attempting to fetch resource', // Firefox
  'The network connection was lost',
  'The Internet connection appears to be offline',
  'Connection closed',
  'network error',
  'aborted',
]

const matches = (message: string, signatures: string[]) =>
  signatures.some((signature) => message.includes(signature))

export const isStaleDeployError = (message: string) =>
  matches(message, STALE_DEPLOY_SIGNATURES)

export const isStaleChunkError = (message: string) =>
  matches(message, STALE_CHUNK_SIGNATURES)

export const isTransportError = (message: string) =>
  matches(message, TRANSPORT_SIGNATURES)

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

// sessionStorage is not always reachable — it is `null` inside a sandboxed
// iframe and throws outright when cookies/storage are blocked. Reading it
// unguarded threw its own TypeError in production, so every access goes through
// these two helpers and degrades to "no guard state" instead of an exception.
const readSession = (key: string): string | null => {
  try {
    return window.sessionStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

const writeSession = (key: string, value: string): void => {
  try {
    window.sessionStorage?.setItem(key, value)
  } catch {
    // Storage blocked — the reload still happens, it just isn't rate-limited
    // across reloads. The in-session ceiling below still applies per document.
  }
}

const RELOAD_AT_KEY = 'reely:stale-deploy-reload'
const RELOAD_COUNT_KEY = 'reely:stale-deploy-reloads'
const RELOAD_GUARD_MS = 15_000
const MAX_RELOADS_PER_SESSION = 2

/**
 * Reload onto the fresh bundle after a stale-deploy failure, with two guards so
 * a genuinely persistent failure can never trap the user in a refresh loop:
 * at most one reload per 15s, and at most two per session. A real stale-deploy
 * hit never recurs after the first reload — the new bundle's action IDs and
 * chunk URLs match the origin.
 */
export const reloadForStaleDeploy = (): void => {
  if (typeof window === 'undefined') return

  const reloads = Number(readSession(RELOAD_COUNT_KEY) ?? 0)
  if (reloads >= MAX_RELOADS_PER_SESSION) return

  // Wall clock, not performance.now(): the guard has to survive the reload it
  // schedules, and performance.now() restarts at 0 in the new document.
  const now = Date.now()
  const last = Number(readSession(RELOAD_AT_KEY) ?? 0)
  if (last && now - last < RELOAD_GUARD_MS) return

  writeSession(RELOAD_AT_KEY, String(now))
  writeSession(RELOAD_COUNT_KEY, String(reloads + 1))
  toast('A new version is available — refreshing…', {
    action: { label: 'Refresh now', onClick: () => window.location.reload() },
  })
  window.setTimeout(() => window.location.reload(), 2500)
}
