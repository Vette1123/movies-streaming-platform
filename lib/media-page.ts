import { Metadata } from 'next'

import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import { genreNames } from '@/lib/media'
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

// How deep to walk each TMDB list when picking what to prerender. Measured
// against the live API: 20/10/3 yielded 542 movie + 592 tv ids (1,134 detail
// pages); 30/15/5 yields 827 + 875 (1,702 detail, 1,921 routes total).
//
// Everything OUTSIDE this set is the expensive case, and prod headers show
// exactly how expensive (measured 2026-08-03 on www.reely.space):
//
//   /movies/550    (prerendered)     -> x-opennext-cache: HIT   no render
//   /movies/47090  (not prerendered) -> x-nextjs-cache: MISS    renders EVERY hit
//
// The incremental cache is read-only and Cloudflare does not edge-cache Worker
// HTML, so a MISS never becomes a HIT no matter how often the URL is requested.
// Those long-tail ids are what the Worker 503s are: the `exceededResources`
// share of invocations sat at 25-40% of all traffic through 2026-08-02, and the
// sampled 503 path list is almost entirely /movies/<id> and /tv-shows/<id>
// outside this set. So the prerender set is sized to swallow as much of the real
// id distribution as the build can afford.
//
// Doubled 2026-08-03 (30/15/5 -> 60/30/8) against the two limits that actually
// bind, both measured from the 2026-08-02 deploy log:
//   - Workers Static Assets: 4,047 files at 1,921 routes (~2.1 files/route),
//     against a 20,000-file cap. ~4,200 routes lands near 8,900 files — 44% of
//     the cap, still room for the genre/collection sets to grow.
//   - Build: 52s to generate 1,921 pages, ~4 min for the whole job. Roughly
//     doubles; deploy.yml timeout went to 30 min to keep the same margin.
// Daily TMDB load roughly doubles too (~3,600 -> ~7,500 requests/day across the
// 2 scheduled builds). Peak concurrency — the thing that actually earns a 429 —
// is capped by the fetch governor and unchanged.
//
// Returns still fall off with depth (page 60 of `popular` is far less requested
// than page 1), so the next lever is NOT depth 120 — it's making a non-
// prerendered render cacheable at all.
const LIST_DEPTH = {
  popular: 60,
  topRated: 30,
  trending: 8,
} as const

// Prerender the head of the traffic distribution: popular, all-time top rated,
// and today's trending, deduped, baked into static assets so they never
// cold-render on the Worker. allSettled (not all) so a single TMDB hiccup drops
// just that page, not the whole set; fail-soft to [] so a build never breaks
// (empty = all-dynamic, no regression).
export async function buildMediaStaticParams(fetchers: {
  popular: PagedFetcher
  topRated: PagedFetcher
  trending: PagedFetcher
}): Promise<{ id: string }[]> {
  try {
    const requests = [
      ...Array.from({ length: LIST_DEPTH.popular }, (_, i) =>
        fetchers.popular({ page: i + 1 })
      ),
      ...Array.from({ length: LIST_DEPTH.topRated }, (_, i) =>
        fetchers.topRated({ page: i + 1 })
      ),
      ...Array.from({ length: LIST_DEPTH.trending }, (_, i) =>
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

// Collection (franchise) pages were the last dynamic route on the site, and the
// only one with NO prerender set at all — so every /collection/<id> hit rendered
// on the Worker, which put it top of the 503 list once the detail-page scrapers
// were challenged away.
//
// TMDB has no "list all collections" endpoint; the id only appears as
// `belongs_to_collection` inside a movie's details. That sounds expensive but is
// nearly free here: the build already fetches details for every prerendered
// movie, so passing the SAME service function (getMovieDetailsById → the
// `append_to_response` URL the detail page itself uses) means Next's build-time
// fetch cache serves the second read. One of the two callers pays; the other
// dedupes.
//
// Measured on a 164-movie sample: 37% belong to a collection, ~45 distinct — so
// the current ~827 prerendered movies yield roughly 227 collection pages.
// Fetchers are injected rather than imported so this module stays free of
// service imports, matching buildMediaStaticParams above.
export async function buildCollectionStaticParams(
  movieParams: () => Promise<{ id: string }[]>,
  getMovieDetails: (
    id: string
  ) => Promise<{ belongs_to_collection?: { id: number } | null } | undefined>
): Promise<{ id: string }[]> {
  try {
    const movies = await movieParams()
    const settled = await Promise.allSettled(
      movies.map((m) => getMovieDetails(m.id))
    )
    const ids = new Set<string>()
    for (const res of settled) {
      if (res.status !== 'fulfilled') continue
      const collectionId = res.value?.belongs_to_collection?.id
      if (collectionId) ids.add(String(collectionId))
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

// Shared generateMetadata body for the movie + series detail pages. They were
// ~92% identical; only the media type, canonical base path, OG type, keyword
// tail, and whether an OG releaseDate is emitted differ. The route resolves its
// typed details object and passes the normalized fields in.
export interface DetailsMetadataInput {
  id: string
  title: string
  releaseDate?: string | null
  overview?: string | null
  backdropPath?: string | null
  posterPath?: string | null
  genres?: { name: string }[]
  basePath: string // '/movies' | '/tv-shows'
  ogType: 'video.movie' | 'video.tv_show'
  keywordsTail: string[] // e.g. ['watch online', 'movie details']
  ogReleaseDate?: string // emitted only when provided (movies)
}

export function buildDetailsMetadata(input: DetailsMetadataInput): Metadata {
  const year = input.releaseDate?.slice(0, 4)
  const title = year ? `${input.title} (${year})` : input.title
  const description =
    input.overview?.slice(0, 200) ||
    `Details, cast, and streaming info for ${input.title} on ${siteConfig.name}.`
  const canonicalPath = `${input.basePath}/${input.id}`
  const images = buildDetailsOgImages(
    input.backdropPath,
    input.posterPath,
    input.title
  )

  return {
    title,
    description,
    keywords: [
      input.title,
      ...(genreNames(input.genres) ?? []),
      ...input.keywordsTail,
      'cast',
      'streaming',
      siteConfig.name,
    ],
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: input.ogType,
      title,
      description,
      url: `${siteConfig.websiteURL}${canonicalPath}`,
      images,
      ...(input.ogReleaseDate ? { releaseDate: input.ogReleaseDate } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
  }
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
