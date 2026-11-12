import { describe, expect, it } from 'vitest'

import aiCrawlers from '@/config/ai-crawlers.json'
import blockedCrawlers from '@/config/blocked-crawlers.json'
import robots from '@/app/robots'

/**
 * Google's robots.txt precedence: the longest matching pattern wins, and on a
 * tie the less restrictive rule (Allow) wins. `*` matches any run of
 * characters, a trailing `$` anchors the end.
 */
const allowedFor = (userAgent: string, path: string) => {
  const rule = robots().rules
  const groups = Array.isArray(rule) ? rule : [rule]
  const group = groups.find((g) =>
    ([] as string[]).concat(g.userAgent ?? []).includes(userAgent)
  )
  if (!group) throw new Error(`no robots group for ${userAgent}`)

  const matches = (pattern: string) => {
    const anchored = pattern.endsWith('$')
    const body = (anchored ? pattern.slice(0, -1) : pattern)
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')
    return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)
  }
  const longest = (patterns?: string | string[]) =>
    Math.max(
      -1,
      ...([] as string[])
        .concat(patterns ?? [])
        .filter(matches)
        .map((p) => p.length)
    )
  return longest(group.allow) >= longest(group.disallow)
}

describe('robots.txt', () => {
  // A tail page (/movies/<id> outside the prerendered set) is the exported
  // media-fallback shell. Hydration resets its head to the shell's own
  // metadata — canonical: the homepage — and useServedMetadata only puts the
  // real head back once the shell's data fetch returns. Googlebot's renderer
  // obeys robots.txt for subresources, so with `/api/` blocked that fetch never
  // happened, and ~15,000 tail pages were filed as "Alternative page with
  // proper canonical tag", user-declared canonical https://www.reely.space/.
  it.each([
    '/api/media/movie/16619',
    '/api/media/tv/71',
    '/api/collection/10',
    '/api/list/some-list',
    '/api/profile/someone',
  ])('lets Googlebot render the data a fallback shell fetches: %s', (path) => {
    expect(allowedFor('Googlebot', path)).toBe(true)
    expect(allowedFor('*', path)).toBe(true)
  })

  it.each([
    '/api/search?q=x',
    '/api/upcoming',
    '/media-fallback',
    '/watch-history',
    '/movies?page=2',
  ])('still keeps crawlers off %s', (path) => {
    expect(allowedFor('Googlebot', path)).toBe(false)
  })

  it('still allows the pages and the cache-busted icons', () => {
    expect(allowedFor('Googlebot', '/movies/16619')).toBe(true)
    expect(allowedFor('Googlebot', '/site.webmanifest?v=2')).toBe(true)
  })
})

/**
 * Being cited by an assistant is search traffic. On 2026-11-12 GPTBot, ClaudeBot
 * and meta-externalagent were refused in robots.txt AND blocked by the WAF, so
 * ChatGPT, Claude and Meta AI could not learn the site existed. Every wanted AI
 * crawler must reach a detail page, and none may be on the WAF's block list
 * (a substring match, so a blocked token inside a wanted one counts too).
 */
describe('AI crawlers', () => {
  const wanted = [...aiCrawlers.search, ...aiCrawlers.knowledge]
  const blocked = [
    ...blockedCrawlers.seoTools,
    ...blockedCrawlers.aiTraining,
    ...blockedCrawlers.noReferral,
  ]
  const groupFor = (userAgent: string) => {
    const rule = robots().rules
    const groups = Array.isArray(rule) ? rule : [rule]
    const named = groups.find((g) =>
      ([] as string[]).concat(g.userAgent ?? []).includes(userAgent)
    )
    return named ? userAgent : '*'
  }

  it.each(wanted)('%s may crawl a detail page', (userAgent) => {
    expect(allowedFor(groupFor(userAgent), '/movies/16619')).toBe(true)
  })

  it.each(wanted)('%s is not on the WAF block list', (userAgent) => {
    const hit = blocked.filter((token) =>
      userAgent.toLowerCase().includes(token.toLowerCase())
    )
    expect(hit).toEqual([])
  })
})
