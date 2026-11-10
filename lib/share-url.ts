import { siteConfig } from '@/config/site'

/**
 * The link a share hands out: always the canonical host, tagged with where the
 * share started. Untagged, every visit a share brought in landed in PostHog as
 * "direct" and nobody could tell sharing apart from typing the URL. The tag is
 * harmless to search: every page's canonical is the clean URL, and robots.txt
 * keeps query strings out of the crawl. Keeps any query the path already has
 * (an invite code), and replaces a utm the sharer arrived with.
 */
export const shareUrl = (path: string, surface: string): string => {
  const url = new URL(path, siteConfig.websiteURL)
  url.searchParams.set('utm_source', 'share')
  url.searchParams.set('utm_medium', surface)
  return url.href
}
