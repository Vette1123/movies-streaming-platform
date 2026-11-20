// Cloud/datacenter networks refused on the paths that bill a Worker invocation.
//
// 2026-11-19: the account hit 93k of its 100k free daily requests. The source
// was a headless-browser fleet on Microsoft Azure (AS8075) and AWS (AS14618),
// ~800 requests per IP, every one a Windows Chrome UA rotated across Chrome
// 103-146 — so the frozen-string block (STALE_BROWSER_UAS) could not see it.
// It walked tail ids: /movies/<id> (43k/day) plus the shell's /api/media/
// payload fetch (18k/day), each one a Worker invocation.
//
// A person does not browse a film catalogue from a cloud VM. Search engines and
// AI crawlers do crawl from these networks (GPTBot is on Azure), but they are
// Cloudflare-verified bots, and both `cf.client.bot` and the allowlist rule ahead
// of this one let them through — SEO is untouched.
//
// Block, not managed_challenge: the 2026-09-01 fleet solved the challenge within
// 40 minutes (see BLOCK_FROZEN_UAS_RULE), and every solved challenge on a tail id
// is still an invocation we pay for.
export const CLOUD_ASNS = [
  8075, // Microsoft Azure
  16509, // Amazon AWS
  14618, // Amazon AWS
  396982, // Google Cloud
  31898, // Oracle Cloud
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH
  63949, // Akamai / Linode
  20473, // Vultr
  51167, // Contabo
  45102, // Alibaba Cloud
  132203, // Tencent Cloud
  // Measured after the first cut went live: the same Chrome/131 fleet moved to
  // rented proxy space. M247 (AS9009) was in that set too and is deliberately
  // NOT here: consumer VPNs run on it, so real people do.
  207990, // HostRoyale
  203020, // HostRoyale
  133499, // HostRoyale
  150436, // BytePlus (ByteDance cloud)
]

// Only the routes that run the Worker. Static assets cost nothing, so a cloud
// client reading a prerendered page is left alone; genre and year hubs are
// prerendered too.
export const WORKER_PATH_PREFIXES = [
  '/movies/',
  '/tv-shows/',
  '/collection/',
  '/api/media/',
  '/api/collection/',
  '/api/season-details',
]

export const STATIC_HUB_PREFIXES = [
  '/movies/genre',
  '/tv-shows/genre',
  '/movies/year',
  '/tv-shows/year',
]

// The deploy smoke test (.github/workflows/deploy.yml) runs on GitHub Actions,
// which is Azure. One fixed page is not what costs money; walking ids is.
export const SMOKE_PATHS = ['/movies/550']

const startsWithAny = (prefixes) =>
  prefixes.map((p) => `starts_with(http.request.uri.path, "${p}")`).join(' or ')

const pathIsAny = (paths) =>
  paths.map((p) => `http.request.uri.path eq "${p}"`).join(' or ')

// 2026-11-20: the fleet came back as a Cloudflare-verified bot. Every request
// carried `cf.client.bot`, so ALLOW_RULE skipped the rest of the ruleset and
// this block never saw it: ~800 requests per IP per day from Azure and AWS,
// all with the same plain UA (`Chrome/131.0 Safari/537.36`, a two-part version
// no real Chrome sends), and no reverse DNS a search engine would publish.
// Every crawler this site wants names itself in its UA (Googlebot, bingbot,
// GPTBot, PerplexityBot, meta-externalagent: all `compatible;` or `*bot`), so
// on a cloud network the verified flag only counts with a name attached.
// Off a cloud network nothing changes.
export const BOT_NAME_TOKENS = ['bot', 'Bot', 'compatible', 'crawler', 'spider']

export const namesItselfBot = (ua = '') =>
  BOT_NAME_TOKENS.some((token) => ua.includes(token))

const namesItselfExpr = () =>
  BOT_NAME_TOKENS.map((t) => `(http.user_agent contains "${t}")`).join(' or ')

const cloudExpr = () => `(ip.src.asnum in {${CLOUD_ASNS.join(' ')}})`

/** A verified bot on a cloud network that will not say what it is. */
export const unnamedCloudBotExpr = () =>
  `(${cloudExpr()} and not (${namesItselfExpr()}))`

/** The verified bots that may skip the ruleset. */
export const trustedBotExpr = () =>
  `(cf.client.bot and not ${unnamedCloudBotExpr()})`

export const cloudAsnExpr = () =>
  cloudExpr() +
  ` and (${startsWithAny(WORKER_PATH_PREFIXES)})` +
  ` and not (${startsWithAny(STATIC_HUB_PREFIXES)})` +
  ` and not (${pathIsAny(SMOKE_PATHS)})` +
  ` and not (cf.client.bot and (${namesItselfExpr()}))`

/** The same decision as cloudAsnExpr(), for the test. */
export function isRefusedCloudRequest({ asn, path, verifiedBot, ua = '' }) {
  if (!CLOUD_ASNS.includes(asn)) return false
  if (verifiedBot && namesItselfBot(ua)) return false
  if (SMOKE_PATHS.includes(path)) return false
  if (STATIC_HUB_PREFIXES.some((p) => path.startsWith(p))) return false
  return WORKER_PATH_PREFIXES.some((p) => path.startsWith(p))
}
