import React from 'react'
import Link from 'next/link'

import { Credit } from '@/types/credit'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { PersonPortraitFallback } from '@/components/media/person-portrait-fallback'

/**
 * Crew jobs worth linking to a person page. Director is the one the extra-info
 * panel already highlights; Writer and Producer are the next most searched.
 */
const CREW_JOBS = new Set(['Director', 'Writer', 'Producer'])

/**
 * A name goes to this site's own page for that person when there is one, and
 * to a Google search when there is not.
 *
 * Only a bounded set of people is prerendered (see services/people.ts), so the
 * caller resolves which of THESE names have a page and passes the ids down —
 * an internal link that 404s is worse than the external one it replaced.
 */
const personHref = (id: number, name: string, linked: Set<number>) =>
  linked.has(id) ? `/person/${id}` : `${SEARCH_ACTOR_GOOGLE}${name}`

const GRID =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5'

/** One cast or crew card: headshot (or monogram), name, role. */
function PersonCard({
  id,
  name,
  profilePath,
  role,
  linked,
}: {
  id: number
  name: string
  profilePath?: string | null
  role?: string
  linked: Set<number>
}) {
  return (
    <Link
      href={personHref(id, name, linked)}
      {...(linked.has(id)
        ? {}
        : { target: '_blank', rel: 'noopener noreferrer' })}
      className="flex flex-col transition-transform duration-300 ease-out hover:scale-105"
    >
      {profilePath ? (
        <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg shadow-md">
          <BlurredImage
            src={getPosterImageURL(profilePath)}
            alt={name}
            fill
            className="cursor-pointer object-cover"
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 25vw, 10vw"
            quality={POSTER_QUALITY}
            intro
          />
        </div>
      ) : (
        <PersonPortraitFallback name={name} className="shadow-md" />
      )}
      <p className="mt-1 truncate text-sm sm:text-base">{name}</p>
      {role && <p className="truncate text-xs text-muted-foreground">{role}</p>}
    </Link>
  )
}

interface DetailsCreditsProps {
  movieCredits: Credit
  /** Cast ids this build prerendered a person page for. */
  linkedPersonIds?: number[]
  /** Full crew array (all jobs); only Director/Writer/Producer are rendered. */
  movieCrew?: Credit['crew']
}

export const DetailsCredits = ({
  movieCredits,
  linkedPersonIds = [],
  movieCrew,
}: DetailsCreditsProps) => {
  const linked = new Set(linkedPersonIds)
  return (
    <>
      <h2 className="text-base font-semibold md:text-xl lg:text-2xl">Cast</h2>
      <div className={GRID}>
        {movieCredits?.cast?.map((cast) => (
          <PersonCard
            key={cast.id}
            id={cast.id}
            name={cast.name}
            profilePath={cast.profile_path}
            role={cast.character}
            linked={linked}
          />
        ))}
      </div>
      {movieCrew && movieCrew.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-base font-semibold md:text-xl lg:text-2xl">
            Crew
          </h2>
          <div className={GRID}>
            {movieCrew
              .filter((person) => CREW_JOBS.has(person.job))
              .map((crew) => (
                // id + job: one person can be both Writer and Producer, and
                // the id alone gave React a duplicate key.
                <PersonCard
                  key={`${crew.id}-${crew.job}`}
                  id={crew.id}
                  name={crew.name}
                  profilePath={crew.profile_path}
                  role={crew.job}
                  linked={linked}
                />
              ))}
          </div>
        </>
      )}
    </>
  )
}
