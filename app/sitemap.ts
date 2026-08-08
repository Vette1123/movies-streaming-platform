import type { MetadataRoute } from 'next'
import {
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getMovieDetailsById,
  getPopularMovies,
} from '@/services/movies'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'
import {
  buildCollectionStaticParams,
  buildMediaStaticParams,
} from '@/lib/media-page'

export const revalidate = 86400

// Required by `output: 'export'` — see app/robots.ts. Emits out/sitemap.xml,
// built from the same TMDB lists the prerendered pages come from.
export const dynamic = 'force-static'

const baseUrl = siteConfig.websiteURL

const buildDate = (): string => new Date().toISOString()

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
const mediaSitemapUrls = async (
  pathPrefix: string,
  params: () => Promise<{ id: string }[]>
): Promise<MetadataRoute.Sitemap> => {
  try {
    const lastModified = buildDate()
    return (await params()).map(({ id }) => ({
      url: `${baseUrl}${pathPrefix}/${id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error(`Error generating ${pathPrefix} URLs for sitemap:`, error)
    return []
  }
}

const movieParams = () =>
  buildMediaStaticParams({
    popular: getPopularMovies,
    topRated: getAllTimeTopRatedMovies,
    trending: getLatestTrendingMovies,
  })

const generateMovieUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/movies', movieParams)

const generateTVShowUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/tv-shows', () =>
    buildMediaStaticParams({
      popular: getPopularSeries,
      topRated: getAllTimeTopRatedSeries,
      trending: getLatestTrendingSeries,
    })
  )

// Franchise pages were in no sitemap at all, despite being prerendered and
// linked from every movie that belongs to one.
const generateCollectionUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/collection', () =>
    buildCollectionStaticParams(movieParams, getMovieDetailsById)
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
  ]

  try {
    const [movieUrls, tvShowUrls, collectionUrls] = await Promise.all([
      generateMovieUrls(),
      generateTVShowUrls(),
      generateCollectionUrls(),
    ])

    return [
      ...staticRoutes,
      ...movieUrls,
      ...tvShowUrls,
      ...collectionUrls,
    ].sort((a, b) => {
      const diff = (b.priority || 0) - (a.priority || 0)
      return diff !== 0 ? diff : a.url.localeCompare(b.url)
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticRoutes
  }
}
