import React from 'react'
import { getGenreList } from '@/services/genres'

import { Movie } from '@/types/movie-result'
import { Carousel } from '@/components/carousel'
import { HeroSlide } from '@/components/header/hero-slide'

export const HeroSlider = async ({ movies }: { movies: Movie[] }) => {
  // Fetch both genre tables once (long-cached, fail-soft) so each mixed-media
  // slide resolves its genre_ids against the correct table.
  const [movieGenres, tvGenres] = await Promise.all([
    getGenreList('movie'),
    getGenreList('tv'),
  ])

  return (
    <div className="relative overflow-hidden">
      <Carousel stageClassName="min-h-[86svh] sm:min-h-[70svh] lg:min-h-screen">
        {movies?.map((movie, index) => {
          const isTv =
            (movie.media_type ?? (movie.first_air_date ? 'tv' : 'movie')) ===
            'tv'
          return (
            <HeroSlide
              key={movie.id}
              movie={movie}
              genreTable={isTv ? tvGenres : movieGenres}
              priority={index === 0}
            />
          )
        })}
      </Carousel>
      <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-linear-to-t from-black to-transparent" />
    </div>
  )
}
