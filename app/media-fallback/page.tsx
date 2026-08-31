'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { MultiMovieDetailsRequestProps } from '@/types/movie-details'
import { MultiSeriesDetailsRequestProps } from '@/types/series-details'
import { getJson } from '@/lib/api-client'
import { getMediaHeroImageUrl } from '@/lib/media'
import { mediaDescription } from '@/lib/seo-description'
import { useLocationPathname } from '@/hooks/use-location-pathname'
import { useServedMetadata } from '@/hooks/use-served-metadata'
import { MoviesDetailsContent } from '@/components/media/details-content'
import { MovieDetailsHero } from '@/components/media/details-hero'
import { SeriesDetailsContent } from '@/components/series/details-content'
import { SeriesDetailsHero } from '@/components/series/details-hero'
import { SeriesPlaybackProvider } from '@/components/series/playback-context'

// The shell for detail ids the build did not prerender.
//
// cloudflare/worker.js serves THIS page's exported HTML for /movies/<id> and
// /tv-shows/<id> when no static asset matches, after injecting the real title,
// OG tags and JSON-LD into its <head> — so crawlers and unfurlers see correct
// metadata while the browser paints the same components a prerendered page
// uses. Reaching /media-fallback directly is not meaningful, hence noindex.
//
// It exists because the alternative — letting Next render these on the server —
// is what was killing the site: every such request re-rendered React on the
// Worker against a 10ms CPU budget.

type Payload = MultiMovieDetailsRequestProps | MultiSeriesDetailsRequestProps

const isSeries = (
  payload: Payload
): payload is MultiSeriesDetailsRequestProps =>
  'seriesDetails' in payload && Boolean(payload.seriesDetails)

// /movies/550 -> { type: 'movie', id: '550' }. Read from the URL rather than a
// route param, because this page is served under a path it does not own.
function parseLocation(
  pathname: string
): { type: 'movie' | 'tv'; id: string } | null {
  const match = pathname.match(/^\/(movies|tv-shows)\/(\d+)/)
  if (!match) return null
  return { type: match[1] === 'tv-shows' ? 'tv' : 'movie', id: match[2] }
}

/** The head this page would have had if the build had prerendered it. */
function servedMetadata(payload?: Payload) {
  if (!payload) return null
  const details = isSeries(payload)
    ? payload.seriesDetails
    : payload.movieDetails
  const name = isSeries(payload)
    ? payload.seriesDetails.name
    : payload.movieDetails.title
  if (!name) return null
  const released = isSeries(payload)
    ? payload.seriesDetails.first_air_date
    : payload.movieDetails.release_date
  const year = (released || '').slice(0, 4)
  return {
    title: year ? `${name} (${year})` : name,
    description: mediaDescription({
      title: name,
      year,
      kind: isSeries(payload) ? ('series' as const) : ('movie' as const),
      genres: details.genres?.map((genre) => genre.name),
      overview: details.overview,
    }),
    image:
      getMediaHeroImageUrl(details.backdrop_path, details.poster_path) ??
      undefined,
    ogType: isSeries(payload) ? 'video.tv_show' : 'video.movie',
  }
}

export default function MediaFallbackPage() {
  const pathname = useLocationPathname()
  const target = React.useMemo(() => parseLocation(pathname), [pathname])

  const { data, isError } = useQuery<Payload>({
    queryKey: ['media-fallback', target?.type, target?.id],
    enabled: Boolean(target),
    staleTime: 60 * 60 * 1000,
    queryFn: () => getJson<Payload>(`/api/media/${target!.type}/${target!.id}`),
  })

  // What the Worker wrote into the head is gone by the time this runs —
  // React re-rendered it from the SHELL's metadata on hydration, which is
  // `noindex, nofollow` and a canonical pointing at the homepage. Googlebot
  // renders JS, so that is what it filed. See hooks/use-served-metadata.ts.
  useServedMetadata(React.useMemo(() => servedMetadata(data), [data]))

  if (isError) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">
          We couldn&apos;t load this title. Please try again.
        </p>
      </div>
    )
  }

  if (!data) return <MediaFallbackSkeleton />

  if (isSeries(data)) {
    return (
      <header className="relative">
        <SeriesPlaybackProvider>
          <SeriesDetailsHero
            series={data.seriesDetails}
            trailerKey={data.trailerKey}
          />
          <SeriesDetailsContent
            series={data.seriesDetails}
            seriesCredits={data.seriesCredits}
            similarSeries={data.similarSeries}
            recommendedSeries={data.recommendedSeries}
          />
        </SeriesPlaybackProvider>
      </header>
    )
  }

  return (
    <header className="relative">
      <MovieDetailsHero
        movie={data.movieDetails}
        trailerKey={data.trailerKey}
      />
      <MoviesDetailsContent
        movie={data.movieDetails}
        movieCredits={data.movieCredits}
        similarMovies={data.similarMovies}
        recommendedMovies={data.recommendedMovies}
      />
    </header>
  )
}

// Mirrors the detail hero's footprint so the paint doesn't shift the page.
function MediaFallbackSkeleton() {
  return (
    <div className="relative">
      <div className="bg-muted/30 h-[70vh] w-full animate-pulse" />
      <div className="container mt-8 space-y-4">
        <div className="bg-muted/30 h-8 w-2/3 animate-pulse rounded" />
        <div className="bg-muted/30 h-4 w-full animate-pulse rounded" />
        <div className="bg-muted/30 h-4 w-5/6 animate-pulse rounded" />
      </div>
    </div>
  )
}
