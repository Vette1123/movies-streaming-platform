// What the Managed Challenge (Cloudflare's smart CAPTCHA) covers.
//
// 2026-11-19: scrapers took the Worker to 93% of its free daily cap. The cloud
// ASN block (./cloud-asn.mjs) stops the networks we know; this stops the ones we
// don't. Every page the Worker renders and every public data API answers a
// challenge first. A real browser passes it in about a second, usually without a
// click, and the pass (cf_clearance) is good for a day (`challenge_ttl` in
// cf-waf-setup.mjs). A scraper either solves it per IP or gets nothing; either
// way a challenge is served by Cloudflare and costs no Worker invocation.
//
// SEO is untouched: `cf.client.bot` (Googlebot, Bingbot, GPTBot, ...) and the
// allowlist rule ahead of this one skip it. Static assets are never challenged —
// prerendered pages and their segment files cost nothing to serve.
//
// A visitor who lands on a static page and calls an API before passing any
// challenge gets a challenged API answer. components/challenge-hop.tsx turns
// that into one top-level hop through CHALLENGE_HOP_PATH, which is challenged
// and then 302s back.

import { SMOKE_PATHS, STATIC_HUB_PREFIXES } from './cloud-asn.mjs'

export const CHALLENGE_HOP_PATH = '/api/verify'

// Worker-rendered pages: tail detail ids, franchises, shared lists, profiles.
export const CHALLENGE_PAGE_PREFIXES = [
  '/movies/',
  '/tv-shows/',
  '/collection/',
  '/l/',
  '/u/',
  '/lists',
]

// Public data APIs, the ones anybody can call anonymously and each costs an
// invocation. Not here, on purpose: /api/stream, /api/pro, /api/device,
// /api/library (the player and the Kodi box call them), /api/calendar and
// /api/og (machine fetchers), /api/auth (OAuth callbacks), /api/sync and the
// account routes (signed-in, session-bound).
export const CHALLENGE_API_PREFIXES = [
  '/api/media/',
  '/api/collection/',
  '/api/season-details',
  '/api/search',
  '/api/filter',
  '/api/popular',
  '/api/genres',
  '/api/watch-providers',
  '/api/reels',
  '/api/hero-extras',
  '/api/list/',
  '/api/profile/',
  '/api/next-up',
  '/api/match/',
  '/api/together/',
  '/api/newsletter/',
  CHALLENGE_HOP_PATH,
]

// The Kodi add-on (kodi/plugin.video.reely/reely_api.py) cannot solve a
// challenge. ponytail: a UA test is spoofable; the cloud-ASN block still holds
// for a fleet that copies it. Upgrade path: a signed device header checked in
// the Worker.
export const KODI_UA = 'Reely-Kodi/'

const startsWithAny = (prefixes) =>
  prefixes.map((p) => `starts_with(http.request.uri.path, "${p}")`).join(' or ')

const pathIsAny = (paths) =>
  paths.map((p) => `http.request.uri.path eq "${p}"`).join(' or ')

/**
 * @param {{ assetExpr: string, hostExempt: string }} parts — the static-asset
 *   test and the player/relay host exemption, owned by cf-waf-setup.mjs.
 */
export const challengeExpr = ({ assetExpr, hostExempt }) =>
  `(((${startsWithAny(CHALLENGE_PAGE_PREFIXES)})` +
  ` and not (${startsWithAny(STATIC_HUB_PREFIXES)})` +
  ` and not (${pathIsAny(SMOKE_PATHS)})` +
  ` and not (${assetExpr}))` +
  ` or (${startsWithAny(CHALLENGE_API_PREFIXES)}))` +
  ' and not cf.client.bot' +
  ` and not (http.user_agent contains "${KODI_UA}")` +
  ` and ${hostExempt}`

/** The same decision as challengeExpr(), for the test. */
export function isChallenged({ path, verifiedBot, ua = '', asset = false }) {
  if (verifiedBot || ua.includes(KODI_UA)) return false
  if (CHALLENGE_API_PREFIXES.some((p) => path.startsWith(p))) return true
  if (!CHALLENGE_PAGE_PREFIXES.some((p) => path.startsWith(p))) return false
  if (STATIC_HUB_PREFIXES.some((p) => path.startsWith(p))) return false
  return !SMOKE_PATHS.includes(path) && !asset
}
