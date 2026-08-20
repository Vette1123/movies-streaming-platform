import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoverMovies, discoverSeries } from '@/services/discover'

import { MediaResponse } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { siteConfig } from '@/config/site'
import { toListEntries } from '@/lib/media'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'
import { Card } from '@/components/card'

/**
 * "Best movies of 2019" — a year, as a page.
 *
 * A query class this site had nothing for: the browse filters can express it,
 * but a filtered browse URL is a query string, which robots.txt disallows and
 * which renders client-side anyway. This is the same question answered by a
 * plain prerendered document.
 *
 * Deliberately NOT infinite-scrolling like the genre pages. Scrolling one of
 * those calls /api/filter, which is Worker CPU per page of results; a year hub
 * is a static list of the titles worth naming and then a link onward. Two TMDB
 * requests at build, zero at runtime.
 */

/** Far enough back to be useful, near enough that TMDB's data is dense. */
export const FIRST_YEAR = 1990

export const yearRange = (): number[] => {
  const last = new Date().getFullYear()
  const years: number[] = []
  for (let year = last; year >= FIRST_YEAR; year--) years.push(year)
  return years
}

export const isValidYear = (value: string): boolean => {
  const year = Number(value)
  return (
    /^\d{4}$/.test(value) &&
    year >= FIRST_YEAR &&
    year <= new Date().getFullYear()
  )
}

export interface YearPageConfig {
  mediaType: ItemType
  basePath: string
  /** "Movies" / "TV Shows" — the breadcrumb and nav label. */
  sectionLabel: string
  /** "movies" / "series" — reads inside a sentence. */
  bodyPlural: string
  discover: (filters: Record<string, string | number>) => Promise<MediaResponse>
}

export const MOVIE_YEAR_PAGE_CONFIG: YearPageConfig = {
  mediaType: 'movie',
  basePath: '/movies',
  sectionLabel: 'Movies',
  bodyPlural: 'movies',
  discover: (filters) => discoverMovies(filters, {}),
}

export const TV_YEAR_PAGE_CONFIG: YearPageConfig = {
  mediaType: 'tv',
  basePath: '/tv-shows',
  sectionLabel: 'TV Shows',
  bodyPlural: 'series',
  discover: (filters) => discoverSeries(filters, {}),
}

export const yearStaticParams = () =>
  yearRange().map((year) => ({ year: String(year) }))

const headingFor = (config: YearPageConfig, year: string) =>
  `The best ${config.bodyPlural} of ${year}`

const descriptionFor = (config: YearPageConfig, year: string) =>
  `The ${config.bodyPlural} released in ${year} that people actually rated — ranked by how many votes they have, with scores and one tap to stream.`

export const yearMetadata = (
  config: YearPageConfig,
  year: string
): Metadata => {
  if (!isValidYear(year)) return {}
  const canonical = `${config.basePath}/year/${year}`
  const title = headingFor(config, year)
  const description = descriptionFor(config, year)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} on ${siteConfig.name}`,
      description,
      url: `${siteConfig.websiteURL}${canonical}`,
    },
  }
}

/** Enough to be a real list; two TMDB pages. */
const PAGES = 2

const dateFilters = (config: YearPageConfig, year: string) => ({
  // `primary_release_year`, NOT a release_date range: TMDB's date filters match
  // ANY release type, so a 2019 re-release or digital drop puts Fight Club and
  // The Matrix at the top of "the best movies of 2019". Measured — that is
  // exactly what the first build of this page shipped. The primary year is the
  // year the film came out.
  ...(config.mediaType === 'movie'
    ? { primary_release_year: year }
    : { first_air_date_year: year }),
  // Vote count, not rating: sorting a year by average score puts a film with
  // four votes above the one everybody saw. This is "what mattered that year".
  sort_by: 'vote_count.desc',
})

export async function YearPage({
  config,
  year,
}: {
  config: YearPageConfig
  year: string
}) {
  if (!isValidYear(year)) notFound()

  const responses = await Promise.allSettled(
    Array.from({ length: PAGES }, (_, index) =>
      config.discover({ ...dateFilters(config, year), page: index + 1 })
    )
  )
  // Fail soft, like every other prerendered list: a TMDB hiccup at build ships
  // a thinner page, never a broken deploy.
  const results = responses.flatMap((response) =>
    response.status === 'fulfilled' ? (response.value?.results ?? []) : []
  )

  const heading = headingFor(config, year)
  const description = descriptionFor(config, year)
  const canonicalPath = `${config.basePath}/year/${year}`
  const url = `${siteConfig.websiteURL}${canonicalPath}`

  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({ name: heading, description, url })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: config.sectionLabel, url: config.basePath },
          { name: year, url: canonicalPath },
        ])}
      />
      <JsonLd
        data={itemListJsonLd(toListEntries(results, config.mediaType), {
          name: heading,
          url: canonicalPath,
        })}
      />

      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {heading}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{description}</p>
      </div>

      {/* Sibling years. One of these pages reaches all of them, which is what
          keeps the set out of the orphan pile. */}
      <nav
        aria-label={`${config.sectionLabel} by year`}
        className="mb-8 flex flex-wrap gap-2"
      >
        {yearRange().map((sibling) => {
          const isCurrent = String(sibling) === year
          return (
            <Link
              key={sibling}
              href={`${config.basePath}/year/${sibling}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                chipVariants({ variant: isCurrent ? 'primary' : 'neutral' }),
                'text-sm'
              )}
            >
              {sibling}
            </Link>
          )
        })}
      </nav>

      {results.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing on file for {year} yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {results.map((item) => (
            <div key={item.id} className="group/card">
              <Card item={item} itemType={config.mediaType} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
