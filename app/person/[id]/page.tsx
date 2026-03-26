import React, { Suspense } from 'react'
import { Metadata } from 'next'
import { UserRound } from 'lucide-react'

import { getPersonCredits, getPersonDetails } from '@/services/person'
import { MediaType } from '@/types/media'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { Biography } from '@/components/person/biography'
import { Badge } from '@/components/ui/badge'

interface PersonPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: PersonPageProps): Promise<Metadata> {
  const { id } = await props.params
  const person = await getPersonDetails(id)
  return {
    title: person.name,
    description: person.biography?.slice(0, 160) || `${person.name} filmography`,
  }
}

export default async function PersonPage(props: PersonPageProps) {
  const { id } = await props.params
  const [person, credits] = await Promise.all([
    getPersonDetails(id),
    getPersonCredits(id),
  ])

  const movies: MediaType[] = credits.cast
    .filter((c) => c.media_type === 'movie' && c.poster_path)
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 20)
    .map((c) => ({
      id: c.id,
      title: c.title || c.name || '',
      overview: '',
      poster_path: c.poster_path!,
      backdrop_path: '',
      release_date: c.release_date || '',
      vote_average: c.vote_average,
      vote_count: 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: c.title || c.name || '',
      popularity: 0,
      video: false,
      media_type: 'movie',
    }))

  const tvShows: MediaType[] = credits.cast
    .filter((c) => c.media_type === 'tv' && c.poster_path)
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 20)
    .map((c) => ({
      id: c.id,
      title: c.name || c.title || '',
      overview: '',
      poster_path: c.poster_path!,
      backdrop_path: '',
      release_date: c.first_air_date || '',
      vote_average: c.vote_average,
      vote_count: 0,
      genre_ids: [],
      adult: false,
      original_language: '',
      original_title: c.name || c.title || '',
      popularity: 0,
      video: false,
      media_type: 'tv',
    }))

  const age = person.birthday
    ? Math.floor(
        (new Date().getTime() - new Date(person.birthday).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  return (
    <main className="container max-w-(--breakpoint-2xl) py-24 lg:py-32">
      {/* Header */}
      <div className="flex flex-col gap-8 sm:flex-row">
        {/* Photo */}
        <div className="mx-auto shrink-0 sm:mx-0">
          <div className="relative h-[280px] w-[190px] overflow-hidden rounded-xl shadow-2xl">
            {person.profile_path ? (
              <BlurredImage
                src={getPosterImageURL(person.profile_path)}
                alt={person.name}
                fill
                intro
                className="object-cover"
                sizes="190px"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-white/5">
                <UserRound className="size-20 text-white/20" strokeWidth={1} />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold lg:text-5xl">{person.name}</h1>
          <div className="flex flex-wrap gap-2">
            {person.known_for_department && (
              <Badge variant="secondary">{person.known_for_department}</Badge>
            )}
            {age && !person.deathday && (
              <Badge variant="outline">Age {age}</Badge>
            )}
            {person.place_of_birth && (
              <Badge variant="outline">{person.place_of_birth}</Badge>
            )}
          </div>
          {person.birthday && (
            <p className="text-sm text-muted-foreground">
              Born {new Date(person.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {person.deathday && (
                <> &mdash; Died {new Date(person.deathday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
            </p>
          )}
          {person.biography && (
            <Biography text={person.biography} />
          )}
        </div>
      </div>

      {/* Credits */}
      <div className="mt-12 space-y-2 border-t border-white/10 pt-10">
        {movies.length > 0 && (
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="Movies" items={movies} itemType="movie" />
          </Suspense>
        )}
        {tvShows.length > 0 && (
          <Suspense fallback={<SliderHorizontalListLoader />}>
            <List title="TV Shows" items={tvShows} itemType="tv" />
          </Suspense>
        )}
      </div>
    </main>
  )
}
