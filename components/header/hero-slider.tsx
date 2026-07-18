import React from 'react'
import { getGenreList } from '@/services/genres'

import { Movie } from '@/types/movie-result'
import { Carousel } from '@/components/carousel'
import { HeroImage, HeroImageMedia } from '@/components/header/hero-image'
import { HeroSectionInfo } from '@/components/header/hero-info'

export const HeroSlider = async ({ movies }: { movies: Movie[] }) => {
  // Fetch both genre tables once (long-cached, fail-soft) so each mixed-media
  // slide resolves its genre_ids against the correct table.
  const [movieGenres, tvGenres] = await Promise.all([
    getGenreList('movie'),
    getGenreList('tv'),
  ])

  return (
    <div className="relative overflow-hidden">
      <Carousel stageClassName="min-h-[500px] lg:min-h-screen">
        {movies?.map((movie, index) => (
          <div
            key={movie.id}
            className="relative size-full overflow-hidden"
          >
            <HeroImage movie={movie as HeroImageMedia} priority={index === 0} />
            {/* Cinematic legibility scrim — dark behind the copy on the left,
                clearing toward the poster on the right so the artwork breathes. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/20 lg:to-transparent" />
            {/* Vertical grounding for the title, meta row and CTA. */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
            <HeroSectionInfo
              movie={movie}
              priority={index === 0}
              genreTable={
                (movie.media_type ?? (movie.first_air_date ? 'tv' : 'movie')) ===
                'tv'
                  ? tvGenres
                  : movieGenres
              }
            />
          </div>
        ))}
      </Carousel>
      <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-linear-to-t from-black to-transparent" />
    </div>
  )
}
