import type { MetadataRoute } from 'next'
import {
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getMovieDetailsById,
  getPopularMovies,
} from '@/services/movies'
import { getPopularPeople } from '@/services/people'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'
import {
  buildCollectionStaticParams,
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

const generateTVShowUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/tv-shows', () =>
    buildMediaSitemapEntries({
      popular: getPopularSeries,
      topRated: getAllTimeTopRatedSeries,
      trending: getLatestTrendingSeries,
    })
  )

// Cast and crew pages. Same treatment as a title: no lastmod, and the portrait
// advertised as an image — a person page is one large photo and a grid.
const generatePersonUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    return (await getPopularPeople()).map((person) => ({
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: SITE_LAUNCH_DATE,
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
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tv-shows`,
      lastModified: SITE_LAUNCH_DATE,
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
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...TV_GENRES_WITH_SLUG.map((genre) => ({
      url: `${baseUrl}/tv-shows/genre/${genre.slug}`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/people`,
      lastModified: SITE_LAUNCH_DATE,
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
        lastModified: SITE_LAUNCH_DATE,
        changeFrequency,
        priority: isCurrentYear ? 0.7 : 0.5,
      }))
    }),
  ]

  try {
    const [movieUrls, tvShowUrls, collectionUrls, personUrls] =
      await Promise.all([
        generateMovieUrls(),
        generateTVShowUrls(),
        generateCollectionUrls(),
        generatePersonUrls(),
      ])

    return [
      ...staticRoutes,
      ...movieUrls,
      ...tvShowUrls,
      ...collectionUrls,
      ...personUrls,
    ].sort((a, b) => {
      const diff = (b.priority || 0) - (a.priority || 0)
      return diff !== 0 ? diff : a.url.localeCompare(b.url)
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticRoutes
  }
}
