import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoverMoviesAction } from '@/actions/filter'

import { siteConfig } from '@/config/site'
import {
  MOVIE_GENRES_WITH_SLUG,
  findMovieGenreBySlug,
} from '@/lib/genres'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'
import { GenreMediaGrid } from '@/components/media/genre-media-grid'

// Static: the genre set is finite and fixed, so all slugs are prebuilt below and
// served from static assets — never rendered on the Worker (no free-plan
// subrequest/CPU caps). revalidate=false → refreshed by the 4x/day CI deploy.
// dynamicParams MUST stay true: under OpenNext/Cloudflare, dynamicParams=false
// 404s even the prebuilt SSG pages (valid genres returned 404). With it true the
// prebuilt genres serve static, and any non-genre slug falls through to one cheap
// on-demand render that notFound()s → 404 (same result, no static regression).
// discoverMoviesAction fetches with revalidate:false (actions/filter.ts), which is
// what makes the route build-only — revalidate=false alone would be floored to 8h
// by the fetch's own revalidate.
export const revalidate = false
export const dynamicParams = true

export function generateStaticParams() {
  return MOVIE_GENRES_WITH_SLUG.map((genre) => ({ slug: genre.slug }))
}

interface GenrePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { slug } = await params
  const genre = findMovieGenreBySlug(slug)
  if (!genre) return {}

  const title = `${genre.name} Movies`
  const description = `Watch the most popular ${genre.name.toLowerCase()} movies. Browse top ${genre.name.toLowerCase()} films and find your next watch on Reely.`

  return {
    title,
    description,
    alternates: { canonical: `/movies/genre/${slug}` },
    openGraph: {
      title: `${title} — Reely`,
      description,
      url: `${siteConfig.websiteURL}/movies/genre/${slug}`,
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

export default async function MovieGenrePage({ params }: GenrePageProps) {
  const { slug } = await params
  const genre = findMovieGenreBySlug(slug)
  if (!genre) notFound()

  // Fail soft: a TMDB hiccup at build shouldn't break the deploy — ship an
  // empty page and let the client grid refetch on mount.
  const initialData = await discoverMoviesAction({
    with_genres: String(genre.id),
    sort_by: 'popularity.desc',
  }).catch(() => ({ page: 1, results: [], total_pages: 0, total_results: 0 }))

  const url = `${siteConfig.websiteURL}/movies/genre/${slug}`
  const description = `Popular ${genre.name.toLowerCase()} movies, refreshed regularly.`

  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({
          name: `${genre.name} Movies`,
          description,
          url,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Movies', url: '/movies' },
          { name: genre.name, url: `/movies/genre/${slug}` },
        ])}
      />

      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {genre.name} Movies
        </h1>
        <p className="text-muted-foreground max-w-2xl">{description}</p>
      </div>

      {/* Sibling-genre nav — discoverability + internal linking for SEO. */}
      <nav
        aria-label="Movie genres"
        className="mb-8 flex flex-wrap gap-2"
      >
        {MOVIE_GENRES_WITH_SLUG.map((g) => (
          <Link
            key={g.id}
            href={`/movies/genre/${g.slug}`}
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

      <GenreMediaGrid
        mediaType="movie"
        genreId={genre.id}
        initialData={initialData}
      />
    </section>
  )
}
