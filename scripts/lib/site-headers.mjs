// Headers for a script that reads our own live pages.
//
// The WAF challenges every client on Worker pages (tail ids, collections,
// public APIs) unless it is a verified crawler or carries the CI pass
// (CI_HEADER in scripts/cf-waf-setup.mjs, secret CI_WAF_BYPASS in .env.local
// and the repo secrets). A browser UA alone gets a 403 managed challenge, which
// made seo:verify report 10 false failures on 2026-11-24. Every script that
// fetches reely.space builds its headers here, so none of them forgets the pass.

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

/**
 * @param {{ CI_WAF_BYPASS?: string }} [env]
 * @returns {Record<string, string>}
 */
export function siteHeaders(env = process.env) {
  /** @type {Record<string, string>} */
  const headers = { 'User-Agent': BROWSER_UA }
  if (env.CI_WAF_BYPASS) headers['x-reely-ci'] = env.CI_WAF_BYPASS
  return headers
}
