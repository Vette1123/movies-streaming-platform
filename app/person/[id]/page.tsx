import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPeopleWithPages, populatePersonPage } from '@/services/people'

import { siteConfig } from '@/config/site'
import { toListEntries } from '@/lib/media'
import { trimBiography } from '@/lib/seo-description'
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  JsonLd,
  personJsonLd,
} from '@/lib/structured-data'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { Card } from '@/components/card'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

// 24h, like the detail pages: a filmography changes about as often as a title
// does, and the redeploy is what actually refreshes it either way.
export const revalidate = 86400

// Required by `output: 'export'`. Unlike a movie id, a person id outside this
// set has NO Worker fallback and never will: the fallback shells exist to keep
// unfurls and crawlers happy on the long tail of title ids, and adding a third
// one would put React-shaped work back on the CPU budget that removing it was
// the whole point of. Ids outside the set get the static 404 asset, at zero
// CPU, and nothing links to them (see lib/person-links.ts).
export const dynamicParams = false

export async function generateStaticParams() {
  const people = getPeopleWithPages()
  return people.map((person) => ({ id: String(person.id) }))
}

const lifeDates = (birthday?: string | null, deathday?: string | null) => {
  if (!birthday) return null
  const born = birthday.slice(0, 4)
  return deathday ? `${born}–${deathday.slice(0, 4)}` : `Born ${born}`
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await props.params
  let data
  try {
    data = await populatePersonPage(id)
  } catch {
    notFound()
  }
  const { person, credits } = data
  const canonical = `/person/${person.id}`
  const known = credits
    .slice(0, 3)
    .map((credit) => credit.title || credit.name)
    .filter(Boolean)
    .join(', ')
  // The description is what a search result shows, so it answers the query
  // somebody actually typed: what this person has been in.
  const description = known
    ? `Every film and series ${person.name} has been in, including ${known}. Ratings, streaming, and what to watch next.`
    : `Films and series featuring ${person.name} on ${siteConfig.name}.`

  return {
    title: `${person.name} — movies and TV shows`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${person.name} on ${siteConfig.name}`,
      description,
      url: `${siteConfig.websiteURL}${canonical}`,
      type: 'profile',
      images: person.profile_path
        ? [{ url: getPosterImageURL(person.profile_path) }]
        : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${person.name} on ${siteConfig.name}`,
      description,
    },
  }
}

const PersonPage = async (props: { params: Promise<{ id: string }> }) => {
  const { id } = await props.params
  let data
  try {
    data = await populatePersonPage(id)
  } catch {
    notFound()
  }
  const { person, credits } = data
  const dates = lifeDates(person.birthday, person.deathday)
  const biography = trimBiography(person.biography)
  const canonical = `/person/${person.id}`

  return (
    <main className="container py-20 lg:py-32">
      <JsonLd
        data={personJsonLd({
          id: person.id,
          name: person.name,
          description: biography || undefined,
          imageUrl: person.profile_path
            ? getPosterImageURL(person.profile_path)
            : undefined,
          birthday: person.birthday,
          deathday: person.deathday,
          birthPlace: person.place_of_birth,
          knownFor: person.known_for_department,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'People', url: '/people' },
          { name: person.name, url: canonical },
        ])}
      />
      <JsonLd
        data={itemListJsonLd(toListEntries(credits), {
          name: `${person.name} — filmography`,
          url: canonical,
        })}
      />

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        <div className="w-40 shrink-0 sm:w-48 md:w-56">
          <div className="relative aspect-2/3 w-full overflow-hidden rounded-2xl shadow-lg">
            {person.profile_path ? (
              <BlurredImage
                src={getPosterImageURL(person.profile_path)}
                alt={person.name}
                fill
                // The column is a fixed 160/192/224 CSS px, so the box never
                // grows with the viewport — a vw-based hint would buy a file
                // several times the size it paints at.
                sizes="224px"
                quality={POSTER_QUALITY}
                className="object-cover"
              />
            ) : (
              <MediaPosterFallback itemType="movie" title={person.name} />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {person.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[person.known_for_department, dates, person.place_of_birth]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {biography && (
            <p className="max-w-3xl leading-relaxed whitespace-pre-line text-muted-foreground">
              {biography}
            </p>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-6 text-xl font-semibold lg:text-2xl">
          {person.name} movies and TV shows
        </h2>
        {credits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on file for {person.name} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {credits.map((credit) => (
              <div
                key={`${credit.media_type}-${credit.id}`}
                className="group/card"
              >
                <Card
                  item={credit}
                  itemType={credit.media_type === 'tv' ? 'tv' : 'movie'}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default PersonPage
