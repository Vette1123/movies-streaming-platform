import React from 'react'
import { getGenreList } from '@/services/genres'
import { buildHeroExtrasSeed } from '@/services/hero-extras'

import { Movie } from '@/types/movie-result'
import { resolveMediaType } from '@/lib/media'
import { Carousel } from '@/components/carousel'
import { HeroExtrasSeeder } from '@/components/header/hero-extras-seeder'
import { HeroSlide } from '@/components/header/hero-slide'

export const HeroSlider = async ({ movies }: { movies: Movie[] }) => {
  // Fetch both genre tables once (long-cached, fail-soft) so each mixed-media
  // slide resolves its genre_ids against the correct table, and resolve every
  // slide's trailer/logo at build so the client never calls /api/hero-extras.
  const [movieGenres, tvGenres, heroExtras] = await Promise.all([
    getGenreList('movie'),
    getGenreList('tv'),
    buildHeroExtrasSeed(
      (movies ?? []).map((movie) => ({
        id: movie.id,
        mediaType: resolveMediaType(movie),
      }))
    ),
  ])

  return (
    <div className="relative overflow-hidden">
      {/* Must precede the Carousel — the hook reads the cache on first render. */}
      <HeroExtrasSeeder seed={heroExtras} />
      {/* Not `lg:min-h-screen`. A full-viewport hero put the page's only
          statement of what this site is below the fold at desktop, so one
          screenshot of the homepage showed a poster wall and nothing else —
          which is what Google's brand review kept rejecting. 88svh leaves the
          hero cinematic and lets the h1 under it break the fold. svh, not vh,
          for the usual mobile-chrome reason. */}
      <Carousel stageClassName="min-h-[86svh] sm:min-h-[70svh] lg:min-h-[88svh]">
        {movies?.map((movie, index) => {
          const isTv = resolveMediaType(movie) === 'tv'
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
