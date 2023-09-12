import React from 'react'
import Link from 'next/link'

import { Credit } from '@/types/credit'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export const DetailsCredits = ({ movieCredits }: { movieCredits: Credit }) => {
  return (
    <>
      <h2 className="text:sm font-semibold lg:text-2xl">Cast</h2>
      <div className="flex flex-wrap items-center gap-4">
        {movieCredits?.cast?.slice(0, 6)?.map((cast) => (
          <Link
            href={`${SEARCH_ACTOR_GOOGLE}${cast.name}`}
            key={cast.id}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-300 ease-in-out hover:scale-105"
          >
            {cast.profile_path && (
              <div className="relative min-h-[200px] min-w-[140px]">
                <BlurredImage
                  src={getPosterImageURL(cast.profile_path)}
                  alt={cast.name}
                  fill
                  className="cursor-pointer rounded-lg bg-cover shadow-md"
                  sizes="(min-width: 640px) 140px, 100px"
                  intro
                />
              </div>
            )}
            <p className="max-w-[140px] truncate">{cast.name}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
