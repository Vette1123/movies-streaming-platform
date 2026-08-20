import { getLatestTrendingMovies, getPopularMovies } from '@/services/movies'
import { getLatestTrendingSeries } from '@/services/series'

import { Movie } from '@/types/movie-result'
import { siteConfig } from '@/config/site'
import { getMediaTitle, mediaDetailHref } from '@/lib/media'
import { getImageURL } from '@/lib/utils'

/**
 * A feed of what is new, for people who never open a search engine.
 *
 * `force-static` is what makes this legal under `output: 'export'` — Next runs
 * the handler once at build and writes out/rss.xml as a plain asset, so it
 * costs the same as any other static file: zero Worker CPU, and it does not
 * count against the invocation cap.
 *
 * Its data comes from the same three lists the homepage is built from, so the
 * feed adds no TMDB requests at all — Next's build fetch cache serves the
 * second reader.
 */
export const dynamic = 'force-static'

/** Long enough to be worth subscribing to, short enough to stay a snapshot. */
const ITEM_LIMIT = 30

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const itemXml = (media: Movie, type: 'movie' | 'tv'): string => {
  const title = getMediaTitle(media) ?? ''
  const link = `${siteConfig.websiteURL}${mediaDetailHref(type, media.id)}`
  const date = media.release_date || media.first_air_date
  return [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${link}</link>`,
    `      <guid isPermaLink="true">${link}</guid>`,
    `      <description>${escapeXml(media.overview ?? '')}</description>`,
    // RFC 822, which is what RSS readers parse. A release date is the only
    // date this feed honestly has; there is no "published to the site" moment.
    date ? `      <pubDate>${new Date(date).toUTCString()}</pubDate>` : '',
    media.poster_path
      ? `      <enclosure url="${getImageURL(media.poster_path)}" type="image/jpeg" />`
      : '',
    '    </item>',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function GET() {
  // allSettled, like every other build-time list: one flaky TMDB call ships a
  // shorter feed rather than failing the deploy.
  const [trendingMovies, popularMovies, trendingSeries] =
    await Promise.allSettled([
      getLatestTrendingMovies(),
      getPopularMovies(),
      getLatestTrendingSeries(),
    ])

  const results = <T>(settled: PromiseSettledResult<{ results?: T[] }>): T[] =>
    settled.status === 'fulfilled' ? (settled.value?.results ?? []) : []

  const seen = new Set<number>()
  const items: string[] = []
  const push = (list: Movie[], type: 'movie' | 'tv') => {
    for (const media of list) {
      if (items.length >= ITEM_LIMIT || !media?.id || seen.has(media.id))
        continue
      seen.add(media.id)
      items.push(itemXml(media, type))
    }
  }
  push(results<Movie>(trendingMovies), 'movie')
  push(results<Movie>(trendingSeries), 'tv')
  push(results<Movie>(popularMovies), 'movie')

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(siteConfig.name)} — what is trending</title>`,
    `    <link>${siteConfig.websiteURL}</link>`,
    `    <description>${escapeXml(siteConfig.description)}</description>`,
    '    <language>en-us</language>',
    `    <atom:link href="${siteConfig.websiteURL}/rss.xml" rel="self" type="application/rss+xml" />`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // The deploy is what refreshes it, same as every other static page here.
      'Cache-Control': 'public, max-age=3600, s-maxage=21600',
    },
  })
}
