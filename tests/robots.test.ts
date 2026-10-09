import { describe, expect, it } from 'vitest'

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
    '/api/billing/bmc',
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
