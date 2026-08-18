'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import { MultiMovieDetailsRequestProps } from '@/types/movie-details'
import { MultiSeriesDetailsRequestProps } from '@/types/series-details'
import { getJson } from '@/lib/api-client'
import { useLocationPathname } from '@/hooks/use-location-pathname'
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

export default function MediaFallbackPage() {
  const pathname = useLocationPathname()
  const target = React.useMemo(() => parseLocation(pathname), [pathname])

  const { data, isError } = useQuery<Payload>({
    queryKey: ['media-fallback', target?.type, target?.id],
    enabled: Boolean(target),
    staleTime: 60 * 60 * 1000,
    queryFn: () => getJson<Payload>(`/api/media/${target!.type}/${target!.id}`),
  })

  // The Worker injects the real <title> into the served HTML, which is what
  // crawlers and unfurlers read — but React re-renders the shell's own title on
  // hydration, so without this the tab (and any bookmark) reverts to the
  // generic site title once the page becomes interactive.
  React.useEffect(() => {
    if (!data) return
    const { name, released } = isSeries(data)
      ? {
          name: data.seriesDetails.name,
          released: data.seriesDetails.first_air_date,
        }
      : {
          name: data.movieDetails.title,
          released: data.movieDetails.release_date,
        }
    if (!name) return
    const year = (released || '').slice(0, 4)
    document.title = year ? `${name} (${year})` : name
  }, [data])

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
