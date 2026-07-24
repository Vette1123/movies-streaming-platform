import { Metadata } from 'next'

import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import { getImageURL, getPosterImageURL } from '@/lib/utils'

// Shared plumbing for the near-identical movies vs tv-shows routes. The two
// browse-list pages were ~95% the same and the two detail pages shared an
// identical generateStaticParams + OG-image builder; only the media type, the
// service functions, and a bit of copy differ.

export interface MediaListPageConfig {
  // Short <title> + MediaContent heading + breadcrumb label (all 'Movies').
  title: string
  // Long OG/Twitter title ('Movies — Browse Popular, Trending & Top Rated').
  ogTitle: string
  description: string
  // Type-specific keywords; siteConfig.keywords are appended in the factory.
  keywords: string[]
  // Canonical path, e.g. '/movies'.
  path: string
}

export const MOVIES_LIST_CONFIG: MediaListPageConfig = {
  title: 'Movies',
  ogTitle: 'Movies — Browse Popular, Trending & Top Rated',
  description:
    'Browse popular, trending, and top-rated movies. Filter by genre, year, and rating to find your next watch on Reely.',
  keywords: [
    'popular movies',
    'trending movies',
    'top rated movies',
    'new releases',
    'movie tracker',
  ],
  path: '/movies',
}

export const TV_LIST_CONFIG: MediaListPageConfig = {
  title: 'TV Shows',
  ogTitle: 'TV Shows — Browse Popular, Trending & Top Rated',
  description:
    'Browse popular, trending, and top-rated TV shows. Track what you watch, discover new series, and never miss an episode on Reely.',
  keywords: [
    'popular tv shows',
    'trending series',
    'top rated tv',
    'new tv shows',
    'tv tracker',
  ],
  path: '/tv-shows',
}

export function mediaListMetadata(config: MediaListPageConfig): Metadata {
  const url = `${siteConfig.websiteURL}${config.path}`
  return {
    title: config.title,
    description: config.description,
    keywords: [...config.keywords, ...siteConfig.keywords],
    alternates: { canonical: config.path },
    openGraph: {
      title: config.ogTitle,
      description: config.description,
      url,
      type: 'website',
      images: '/opengraph-image.png',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.ogTitle,
      description: config.description,
      images: '/opengraph-image.png',
    },
  }
}

type PagedFetcher = (args: {
  page: number
}) => Promise<MediaResponse | undefined>

// Prerender the head of the traffic distribution: popular (20 pages), all-time
// top rated (10), and today's trending (3). Deduped → the ~500 hottest titles
// baked into static assets so they never cold-render on the Worker. allSettled
// (not all) so a single TMDB hiccup drops just that page, not the whole set;
// fail-soft to [] so a build never breaks (empty = all-dynamic, no regression).
export async function buildMediaStaticParams(fetchers: {
  popular: PagedFetcher
  topRated: PagedFetcher
  trending: PagedFetcher
}): Promise<{ id: string }[]> {
  try {
    const requests = [
      ...Array.from({ length: 20 }, (_, i) =>
        fetchers.popular({ page: i + 1 })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        fetchers.topRated({ page: i + 1 })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        fetchers.trending({ page: i + 1 })
      ),
    ]
    const responses = await Promise.allSettled(requests)
    const ids = new Set<string>()
    for (const res of responses) {
      if (res.status !== 'fulfilled') continue
      for (const item of res.value?.results ?? []) ids.add(String(item.id))
    }
    return Array.from(ids, (id) => ({ id }))
  } catch {
    return []
  }
}

export interface OgImage {
  url: string
  width: number
  height: number
  alt: string
}

// The backdrop (16:9) + poster (2:3) OpenGraph image pair used by both detail
// pages, dropping whichever asset the title is missing.
export function buildDetailsOgImages(
  backdropPath: string | null | undefined,
  posterPath: string | null | undefined,
  alt: string
): OgImage[] {
  const backdrop = backdropPath ? getImageURL(backdropPath) : undefined
  const poster = posterPath ? getPosterImageURL(posterPath) : undefined
  return [
    backdrop && { url: backdrop, width: 1280, height: 720, alt },
    poster && { url: poster, width: 500, height: 750, alt },
  ].filter(Boolean) as OgImage[]
}
