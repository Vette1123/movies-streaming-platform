import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoverMovies, discoverSeries } from '@/services/discover'

import { FilterParams } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import {
  findMovieGenreBySlug,
  findTvGenreBySlug,
  GenreWithSlug,
  MOVIE_GENRES_WITH_SLUG,
  TV_GENRES_WITH_SLUG,
} from '@/lib/genres'
import { toListEntries } from '@/lib/media'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'
import { DiscoverGrid } from '@/components/media/discover-grid'
import { SectionErrorBoundary } from '@/components/section-error-boundary'

// One config per media type drives the two genre landing routes. The routes
// themselves keep only the load-bearing static-config exports (`revalidate`,
// `dynamicParams`) that Next must read as literals — everything else delegates
// here so the SEO/JSON-LD/markup can't drift between movies and TV.
export interface GenrePageConfig {
  mediaType: 'movie' | 'tv'
  basePath: string // '/movies' | '/tv-shows'
  sectionLabel: string // 'Movies' | 'TV Shows'
  bodyPlural: string // 'movies' | 'TV shows'
  navLabel: string // 'Movie genres' | 'TV genres'
  genres: GenreWithSlug[]
  findBySlug: (slug: string) => GenreWithSlug | undefined
  discover: (filterParams: FilterParams) => Promise<MediaResponse>
  metaDescription: (genreName: string) => string
}

export const MOVIE_GENRE_PAGE_CONFIG: GenrePageConfig = {
  mediaType: 'movie',
  basePath: '/movies',
  sectionLabel: 'Movies',
  bodyPlural: 'movies',
  navLabel: 'Movie genres',
  genres: MOVIE_GENRES_WITH_SLUG,
  findBySlug: findMovieGenreBySlug,
  discover: discoverMovies,
  metaDescription: (name) =>
    `Watch the most popular ${name.toLowerCase()} movies. Browse top ${name.toLowerCase()} films and find your next watch on Reely.`,
}

export const TV_GENRE_PAGE_CONFIG: GenrePageConfig = {
  mediaType: 'tv',
  basePath: '/tv-shows',
  sectionLabel: 'TV Shows',
  bodyPlural: 'TV shows',
  navLabel: 'TV genres',
  genres: TV_GENRES_WITH_SLUG,
  findBySlug: findTvGenreBySlug,
  discover: discoverSeries,
  metaDescription: (name) =>
    `Watch the most popular ${name.toLowerCase()} TV shows. Browse top ${name.toLowerCase()} series and find your next binge on Reely.`,
}

export function genreStaticParams(config: GenrePageConfig) {
  return config.genres.map((genre) => ({ slug: genre.slug }))
}

export async function genreMetadata(
  config: GenrePageConfig,
  slug: string
): Promise<Metadata> {
  const genre = config.findBySlug(slug)
  if (!genre) return {}

  const title = `${genre.name} ${config.sectionLabel}`
  const description = config.metaDescription(genre.name)
  const canonical = `${config.basePath}/genre/${slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} — Reely`,
      description,
      url: `${siteConfig.websiteURL}${canonical}`,
      type: 'website',
      images: '/opengraph-image.png',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: '/opengraph-image.png',
    },
  }
}

export async function GenrePage({
  config,
  slug,
}: {
  config: GenrePageConfig
  slug: string
}) {
  const genre = config.findBySlug(slug)
  if (!genre) notFound()

  // Fail soft: a TMDB hiccup at build shouldn't break the deploy — ship an
  // empty page and let the client grid refetch on mount.
  const initialData = await config
    .discover({
      with_genres: String(genre.id),
      sort_by: 'popularity.desc',
    })
    .catch(() => ({ page: 1, results: [], total_pages: 0, total_results: 0 }))

  const heading = `${genre.name} ${config.sectionLabel}`
  const canonicalPath = `${config.basePath}/genre/${slug}`
  const url = `${siteConfig.websiteURL}${canonicalPath}`
  const description = `Popular ${genre.name.toLowerCase()} ${config.bodyPlural}, refreshed regularly.`

  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({ name: heading, description, url })}
      />
      <JsonLd
        data={itemListJsonLd(
          toListEntries(initialData?.results ?? [], config.mediaType),
          { name: heading, url: canonicalPath }
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: config.sectionLabel, url: config.basePath },
          { name: genre.name, url: canonicalPath },
        ])}
      />

      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {heading}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{description}</p>
      </div>

      {/* Sibling-genre nav — discoverability + internal linking for SEO. */}
      <nav aria-label={config.navLabel} className="mb-8 flex flex-wrap gap-2">
        {config.genres.map((g) => (
          <Link
            key={g.id}
            href={`${config.basePath}/genre/${g.slug}`}
            aria-current={g.slug === slug ? 'page' : undefined}
            className={cn(
              chipVariants({
                variant: g.slug === slug ? 'primary' : 'neutral',
              }),
              'text-sm',
              g.slug !== slug &&
                'hover:border-primary/50 hover:bg-primary/10 hover:text-foreground'
            )}
          >
            {g.name}
          </Link>
        ))}
      </nav>

      {/* Genre infinite-scroll paginates through the Worker API; a failure
          there should leave the genre nav above it intact. */}
      <SectionErrorBoundary
        section={`${config.mediaType}_genre_grid`}
        title="This genre didn't load"
      >
        <DiscoverGrid
          mediaType={config.mediaType}
          filters={{
            with_genres: String(genre.id),
            sort_by: 'popularity.desc',
          }}
          cacheKey={['genre', genre.id]}
          initialData={initialData}
          emptyMessage="Nothing here yet — try another genre."
        />
      </SectionErrorBoundary>
    </section>
  )
}
