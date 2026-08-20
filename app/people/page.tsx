import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { getPopularPeople } from '@/services/people'

import { siteConfig } from '@/config/site'
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from '@/lib/structured-data'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'

export const revalidate = 86400

const TITLE = 'Actors and directors'
const DESCRIPTION =
  'The people behind the films and series on Reely — every title they have been in, with ratings and where to stream them.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/people' },
  openGraph: {
    title: `${TITLE} on ${siteConfig.name}`,
    description: DESCRIPTION,
    url: `${siteConfig.websiteURL}/people`,
  },
}

/**
 * The index that keeps the person pages from being orphans.
 *
 * A page reachable only from the sitemap is a page Google treats as
 * unimportant, and person pages are otherwise linked from just the handful of
 * title pages that happen to feature them. One hub linking all of them costs a
 * single route and fixes that.
 */
const PeoplePage = async () => {
  const people = await getPopularPeople()

  return (
    <main className="container py-20 lg:py-32">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'People', url: '/people' },
        ])}
      />
      <JsonLd
        data={itemListJsonLd(
          people.map((person) => ({
            id: person.id,
            name: person.name,
            path: `/person/${person.id}`,
            image: person.profile_path
              ? getPosterImageURL(person.profile_path)
              : null,
          })),
          { name: TITLE, url: '/people' }
        )}
      />

      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {TITLE}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{DESCRIPTION}</p>
      </div>

      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {people.map((person) => (
          <li key={person.id}>
            <Link
              href={`/person/${person.id}`}
              className="group flex flex-col gap-2"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg shadow-md">
                <BlurredImage
                  src={getPosterImageURL(person.profile_path ?? '')}
                  alt={person.name}
                  fill
                  // A 6-8 column grid of a contained page: the tile paints at
                  // ~150 CSS px on a desktop and ~110 on a phone.
                  sizes="(max-width: 640px) 30vw, (max-width: 1024px) 22vw, 12vw"
                  quality={POSTER_QUALITY}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="truncate text-sm font-medium">
                {person.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default PeoplePage
