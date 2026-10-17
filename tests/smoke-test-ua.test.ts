import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The deploy's smoke test is the site's 5xx alarm, and it was blind. It sent a
// hard-coded Chrome 120 user-agent, which on 2026-09-01 became one of the
// frozen scraper fingerprints our own WAF blocks (STALE_BROWSER_UAS in
// scripts/cf-waf-setup.mjs). Every path but `/` answered 403, and since only a
// 5xx failed the step, it passed for six weeks while checking one page.
// That script calls the Cloudflare API when loaded, so its list is read as
// text here rather than imported.

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const staleUas = () => {
  const list = read('scripts/cf-waf-setup.mjs').match(
    /const STALE_BROWSER_UAS = \[([\s\S]*?)\]/
  )
  if (!list) throw new Error('STALE_BROWSER_UAS not found in cf-waf-setup.mjs')
  return [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const browserMajor = (ua: string, browser: string) =>
  ua.match(new RegExp(`${browser}/(\\d+)`))?.[1]

describe('the deploy smoke test gets past our own WAF', () => {
  const workflow = read('.github/workflows/deploy.yml')

  it('reads the blocked fingerprints it is checked against', () => {
    expect(staleUas().length).toBeGreaterThan(5)
  })

  it('never sends a user-agent the WAF blocks', () => {
    for (const ua of staleUas()) expect(workflow).not.toContain(ua)
  })

  it('falls back to a Chrome the WAF has not frozen', () => {
    const frozen = new Set(
      staleUas()
        .map((ua) => browserMajor(ua, 'Chrome'))
        .filter(Boolean)
    )
    const fallback = workflow.match(/CHROME=(\d+) ;;/)?.[1]
    expect(fallback).toBeDefined()
    expect(frozen.has(fallback)).toBe(false)
  })
})
