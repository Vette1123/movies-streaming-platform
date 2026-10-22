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

  // Animation titles (TMDB genre id 16, both movie and TV tables) are kept out
  // of the hero — flat graphic illustration doesn't benefit from the backdrop
  // treatment, and the hero is for cinematic titles.
  const ANIMATION_ID = 16
  const animationIds = new Set([ANIMATION_ID])
  const isAnimation = (media: Movie) => {
    const ids = 'genre_ids' in media ? (media.genre_ids ?? []) : []
    return ids.some((id) => animationIds.has(id))
  }

  const eligible = (movies ?? []).filter((m) => !isAnimation(m))

  return (
    <div className="relative overflow-hidden">
      {/* Premium glow behind the hero stage — a slow roaming bloom that makes
          the backdrop feel like it's emitting light. Only on hover-capable
          devices; phones skip it (it sits behind an opaque hero anyway). */}
      <div className="hero-glow" aria-hidden="true" />
      {/* Must precede the Carousel — the hook reads the cache on first render. */}
      <HeroExtrasSeeder seed={heroExtras} />
      {/* No autoplay: the hero is a poster, not a slot machine. A slide that
          changes on its own is motion the reader did not ask for, and it
          moves the thing they are reading. The swipe and the dots are still
          there - a visitor picks the slide. */}
      <Carousel
        stageClassName="min-h-[86svh] sm:min-h-[70svh] lg:min-h-svh border border-white/5 backdrop-blur-sm"
        autoPlay={false}
      >
        {eligible?.map((movie, index) => {
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
