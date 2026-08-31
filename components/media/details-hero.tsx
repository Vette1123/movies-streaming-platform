'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { movieStreamUrl } from '@/config/sources'
import { buildMediaEventBase, trackMediaDetailViewed } from '@/lib/analytics'
import { useStreamSource } from '@/hooks/use-stream-source'
import { DetailsHero } from '@/components/details-hero'

export const MovieDetailsHero = ({
  movie,
  trailerKey,
}: {
  movie: MovieDetails
  trailerKey?: string
}) => {
  // Whether play was pressed, not the URL it produced. The URL is derived, so
  // switching server re-points the frame without a second piece of state that
  // could disagree with the chosen source. (It used to write
  // iframeRef.current.src behind an `if (iframeRef.current)` guard, so a play
  // that landed while the ref was empty did nothing at all and said nothing.)
  const [playing, setPlaying] = React.useState(false)
  const sourceControl = useStreamSource(`movie:${movie?.id}`)

  React.useEffect(() => {
    if (!movie?.id) return
    trackMediaDetailViewed(buildMediaEventBase(movie, 'movie'))
    // Keyed on the id alone: the payload is what the page rendered from and
    // cannot change under a stable id, and depending on the object would fire
    // this view event again on every re-render that hands us a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id])

  const src =
    playing && movie?.id ? movieStreamUrl(sourceControl.source, movie.id) : ''

  return (
    <DetailsHero
      movie={movie}
      src={src}
      playVideo={() => setPlaying(true)}
      trailerKey={trailerKey}
      sourceControl={sourceControl}
      selfHost={
        movie?.id
          ? {
              type: 'movie',
              id: movie.id,
              title: movie.title,
              year: Number(movie.release_date?.slice(0, 4)) || undefined,
              imdb: movie.imdb_id || undefined,
            }
          : undefined
      }
    />
  )
}
