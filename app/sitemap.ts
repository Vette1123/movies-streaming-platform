import type { MetadataRoute } from 'next'
import {
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getMovieDetailsById,
  getPopularMovies,
} from '@/services/movies'
import { getPeopleWithPages } from '@/services/people'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
  getSeriesDetailsById,
} from '@/services/series'

import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'
import {
  buildCollectionStaticParams,
  buildLinkedMediaIds,
  buildMediaSitemapEntries,
} from '@/lib/media-page'
import { getPosterImageURL } from '@/lib/utils'
import { yearRange } from '@/components/media/year-page'

export const revalidate = 86400

// Required by `output: 'export'` — see app/robots.ts. Emits out/sitemap.xml,
// built from the same TMDB lists the prerendered pages come from.
export const dynamic = 'force-static'

const baseUrl = siteConfig.websiteURL

// The sitemap is built from the SAME helper that decides what gets prerendered,
// not from its own hand-picked list of TMDB pages.
//
// It used to fetch 7 movie + 6 TV list pages of its own and advertise whatever
// came back — 240 URLs. Meanwhile LIST_DEPTH prerenders ~1,000 detail routes
// and buildCollectionStaticParams another ~230 franchise pages, so the sitemap
// was omitting three quarters of the site and listing some ids that were never
// baked. Sharing the helper means the two sets cannot drift again, and it is
// close to free at build time: the detail routes already issue these exact
// requests, so Next's build fetch cache serves the second read.
//
// NO `lastModified` on these.
//
// They used to carry the build timestamp, which told Google that all ~2,100
// detail pages changed every six hours — every deploy, forever. That is not
// true (a film's page is the same page it was last year), and an untrustworthy
// lastmod is worse than none: Google stops believing the field across the whole
// sitemap and crawl budget goes to re-fetching pages that did not change. The
// static routes below keep a date because theirs is real and fixed.
//
// The poster IS worth advertising. These pages are one large image each and
// Google Images is a discovery channel this site was not in; the URL comes free
// with the list request the prerender already makes.
const mediaSitemapUrls = async (
  pathPrefix: string,
  params: () => Promise<{ id: string; posterPath?: string }[]>
): Promise<MetadataRoute.Sitemap> => {
  try {
    return (await params()).map(({ id, posterPath }) => ({
      url: `${baseUrl}${pathPrefix}/${id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
      ...(posterPath ? { images: [getPosterImageURL(posterPath)] } : {}),
    }))
  } catch (error) {
    console.error(`Error generating ${pathPrefix} URLs for sitemap:`, error)
    return []
  }
}

const movieEntries = () =>
  buildMediaSitemapEntries({
    popular: getPopularMovies,
    topRated: getAllTimeTopRatedMovies,
    trending: getLatestTrendingMovies,
  })

const generateMovieUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/movies', movieEntries)

const seriesEntries = () =>
  buildMediaSitemapEntries({
    popular: getPopularSeries,
    topRated: getAllTimeTopRatedSeries,
    trending: getLatestTrendingSeries,
  })

const generateTVShowUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/tv-shows', seriesEntries)

// The tail the prerendered pages link to: the similar/recommended rails on every
// detail page point at ids outside the prerendered set, and those pages are real
// — the Worker serves them with full metadata. They were in no sitemap and had
// never been submitted to IndexNow, which is exactly what Bing reported. Lower
// priority than a baked page because that is the truth: these are the second
// ring out. See buildLinkedMediaIds.
const linkedMediaUrls = (
  pathPrefix: string,
  baseParams: () => Promise<{ id: string }[]>,
  getDetails: Parameters<typeof buildLinkedMediaIds>[1]
): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls(pathPrefix, () =>
    buildLinkedMediaIds(baseParams, getDetails)
  ).then((urls) => urls.map((entry) => ({ ...entry, priority: 0.5 })))

const generateLinkedMovieUrls = (): Promise<MetadataRoute.Sitemap> =>
  linkedMediaUrls(
    '/movies',
    () => movieEntries().then((entries) => entries.map(({ id }) => ({ id }))),
    getMovieDetailsById
  )

const generateLinkedTVShowUrls = (): Promise<MetadataRoute.Sitemap> =>
  linkedMediaUrls(
    '/tv-shows',
    () => seriesEntries().then((entries) => entries.map(({ id }) => ({ id }))),
    getSeriesDetailsById
  )

// Cast and crew pages. Same treatment as a title: no lastmod, and the portrait
// advertised as an image — a person page is one large photo and a grid.
const generatePersonUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    return getPeopleWithPages().map((person) => ({
      url: `${baseUrl}/person/${person.id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      ...(person.profile_path
        ? { images: [getPosterImageURL(person.profile_path)] }
        : {}),
    }))
  } catch (error) {
    console.error('Error generating person URLs for sitemap:', error)
    return []
  }
}

// Franchise pages were in no sitemap at all, despite being prerendered and
// linked from every movie that belongs to one.
const generateCollectionUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/collection', () =>
    buildCollectionStaticParams(
      () => movieEntries().then((entries) => entries.map(({ id }) => ({ id }))),
      getMovieDetailsById
    )
  )

const SITE_LAUNCH_DATE = '2024-01-01T00:00:00.000Z'

// When the browse hubs last changed, which is this build.
//
// The hubs carried SITE_LAUNCH_DATE, and that is a false answer in the
// direction that costs the most: it told Google the homepage, /movies,
// /tv-shows and every genre hub had not changed since January 2024. They change
// on every deploy — their rows are trending and popular lists that turn over,
// which is the whole reason the site redeploys every six hours — and they are
// the pages a crawler walks to reach everything else. Search Console on
// 2026-08-28 had 43,781 pages sitting in states a recrawl would clear (15,989
// "Server error (5xx)" from the 3 Aug migration, 11,464 "Excluded by noindex"
// and 6,923 "Duplicate without canonical" from the shell bug, 9,405
// "Crawled - currently not indexed"), all of them fixed in the code and all of
// them waiting on a crawler that had been told not to bother.
//
// This is NOT the mistake the comment above warns about. That one put the build
// timestamp on ~2,100 DETAIL pages, claiming a film's page changed every six
// hours when it had not changed in years; Google stops trusting the field
// across the whole sitemap when it is used that way. A hub whose content
// genuinely turns over every deploy is the case lastmod exists for. Detail
// pages still carry none.
//
// `dynamic = 'force-static'` means this evaluates once, at build.
const CONTENT_REFRESHED_AT = new Date().toISOString()

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // Two entry pages that exist to be found: one answers "what should I watch"
    // for somebody with no account, the other indexes what people published.
    {
      url: `${baseUrl}/start`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lists`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tv-shows`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Indexable on purpose, unlike /account and /watchlist: this one is the same
    // page for everybody, it is the only page that explains what supporting the
    // site buys, and it is what a search for "reely supporter" should find.
    {
      url: `${baseUrl}/support`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // The trailer feed: same content for every visitor, and a discovery
    // surface worth crawling.
    {
      url: `${baseUrl}/reels`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/mood`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/match-night`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/watch-together`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Google's OAuth brand review fetches both of these directly, and a page a
    // reviewer has to be able to read is a page worth being in the sitemap.
    {
      url: `${baseUrl}/privacy`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...MOVIE_GENRES_WITH_SLUG.map((genre) => ({
      url: `${baseUrl}/movies/genre/${genre.slug}`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...TV_GENRES_WITH_SLUG.map((genre) => ({
      url: `${baseUrl}/tv-shows/genre/${genre.slug}`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/people`,
      lastModified: CONTENT_REFRESHED_AT,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    // Year hubs. Weekly for the current year (it keeps filling up), yearly for
    // the ones that are finished — the honest answer in both cases.
    ...yearRange().flatMap((year) => {
      const isCurrentYear = year === new Date().getFullYear()
      const changeFrequency = isCurrentYear
        ? ('weekly' as const)
        : ('yearly' as const)
      return ['/movies', '/tv-shows'].map((basePath) => ({
        url: `${baseUrl}${basePath}/year/${year}`,
        lastModified: isCurrentYear ? CONTENT_REFRESHED_AT : SITE_LAUNCH_DATE,
        changeFrequency,
        priority: isCurrentYear ? 0.7 : 0.5,
      }))
    }),
  ]

  try {
    const [
      movieUrls,
      tvShowUrls,
      collectionUrls,
      personUrls,
      linkedMovieUrls,
      linkedTVShowUrls,
    ] = await Promise.all([
      generateMovieUrls(),
      generateTVShowUrls(),
      generateCollectionUrls(),
      generatePersonUrls(),
      generateLinkedMovieUrls(),
      generateLinkedTVShowUrls(),
    ])

    return [
      ...staticRoutes,
      ...movieUrls,
      ...tvShowUrls,
      ...collectionUrls,
      ...personUrls,
      ...linkedMovieUrls,
      ...linkedTVShowUrls,
    ].sort((a, b) => {
      const diff = (b.priority || 0) - (a.priority || 0)
      return diff !== 0 ? diff : a.url.localeCompare(b.url)
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticRoutes
  }
}
