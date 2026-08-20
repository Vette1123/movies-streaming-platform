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
// SIZED BY THE ASSET CAP, not by CPU — and the difference matters.
//
// It was briefly widened to 60/30/8 (3,648 routes) while OpenNext was still in
// place, because back then a non-prerendered id re-rendered React on the Worker
// on every hit. That is no longer true: the static export serves prerendered
// pages without invoking the Worker at all, and cloudflare/worker.js answers a
// tail id with one TMDB fetch plus an HTMLRewriter pass (~1-3ms), caches it in
// `caches.default`, and injects the same title/OG/JSON-LD a prerendered page
// carries. A miss is now cheap AND still indexable, so a huge prerendered set
// stopped being the thing protecting the site.
//
// What binds instead is the Workers Static Assets limit of 20,000 files. A
// static export writes ~10 files per route, not the ~2 OpenNext produced: one
// .html, one .txt, and eight per-segment client-prefetch payloads
// (`__next._tree.txt`, `__next._full.txt`, …). Next 16.2 has no flag to turn
// those off — there is no `experimental.clientSegmentCache` key in its config
// types — so the cap is a hard ceiling of roughly 1,900 routes.
//
// Measured at 60/30/8: 3,714 routes → 36,819 files and 2.06 GB. Well over.
//
// Re-measured 2026-08-08 at 15/8/3: 1,045 routes → 6,335 files. That is 6.1
// files per route, not the ~10 assumed above, so the ceiling is nearer 3,200
// routes than 1,900 and there was a lot of unused headroom.
//
// 30/16/6 measured: 2,005 routes → 12,131 files (61% of the cap) and 905 MB in
// out/. That doubles the indexable surface — the sitemap goes 1,034 → 1,998
// URLs — while keeping ~7,800 files in reserve for the genre and collection
// sets, which grow on their own as TMDB's lists move.
//
// Re-measure with `find out -type f | wc -l` before going further: the
// per-route file count is a Next implementation detail that has already moved
// once, and the cap is a hard failure, not a degradation.
//
// app/sitemap.ts is built from this same helper, so widening LIST_DEPTH widens
// the sitemap with it — they used to be derived from different TMDB lists, and
// the sitemap advertised a quarter of the pages the build actually baked.
// Nudged popular 30 -> 33: measured 2,127 routes -> 12,863 files (64% of the
// cap), sitemap 2,120 URLs. Note the route count is emergent, not a dial: these
// pages are TMDB's live lists, deduped against each other, and the collection
// set is whatever those movies happen to belong to. It moves by tens of routes
// between builds on its own, so treat any exact figure here as "about".
const LIST_DEPTH = {
  popular: 33,
  topRated: 16,
  trending: 6,
} as const

// Prerender the head of the traffic distribution: popular, all-time top rated,
// and today's trending, deduped, baked into static assets so they never
// cold-render on the Worker. allSettled (not all) so a single TMDB hiccup drops
// just that page, not the whole set; fail-soft to [] so a build never breaks
// (empty = all-dynamic, no regression).
export async function buildMediaSitemapEntries(fetchers: {
  popular: PagedFetcher
  topRated: PagedFetcher
  trending: PagedFetcher
}): Promise<{ id: string; posterPath?: string }[]> {
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
    const ids = new Map<string, string | undefined>()
    for (const res of responses) {
      if (res.status !== 'fulfilled') continue
      for (const item of res.value?.results ?? []) {
        const id = String(item.id)
        // First sighting wins; a title appears on several of these lists and
        // the poster is the same either way.
        if (!ids.has(id)) ids.set(id, item.poster_path || undefined)
      }
    }
    return Array.from(ids, ([id, posterPath]) => ({ id, posterPath }))
  } catch {
    return []
  }
}

/**
 * The same set, as `generateStaticParams` wants it.
 *
 * Next hands whatever this returns straight to the route as params, so it gets
 * the id and nothing else — an extra key here becomes an extra param there.
 * app/sitemap.ts calls the wide version instead and picks up the poster, which
 * is free: both go through the same TMDB list requests and Next's build fetch
 * cache serves the second reader.
 */
export async function buildMediaStaticParams(fetchers: {
  popular: PagedFetcher
  topRated: PagedFetcher
  trending: PagedFetcher
}): Promise<{ id: string }[]> {
  return (await buildMediaSitemapEntries(fetchers)).map(({ id }) => ({ id }))
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
