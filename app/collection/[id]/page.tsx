import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCollectionById } from '@/services/movies'
import { Layers } from 'lucide-react'

import { MediaType } from '@/types/media'
import { Movie } from '@/types/movie-result'
import { PageDetailsProps } from '@/types/page-details'
import { siteConfig } from '@/config/site'
import { breadcrumbJsonLd, JsonLd } from '@/lib/structured-data'
import { getImageURL, pluralize } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { Card } from '@/components/card'

// Collections are static franchise metadata — safe to cache long and let CI
// repopulate. Mirrors the movie-details revalidate window.
export const revalidate = 86400
export const dynamicParams = true

// Chronological franchise order (earliest first); undated entries sort last so a
// not-yet-released sequel doesn't jump the row.
const byReleaseDate = (a: Movie, b: Movie) => {
  const da = a.release_date || '9999'
  const db = b.release_date || '9999'
  return da.localeCompare(db)
}

export async function generateMetadata(
  props: PageDetailsProps
): Promise<Metadata> {
  const params = await props.params
  let collection
  try {
    collection = await getCollectionById(params.id)
  } catch {
    notFound()
  }
  if (!collection?.id) notFound()

  const description =
    collection.overview?.slice(0, 200) ||
    `Every film in the ${collection.name} on ${siteConfig.name}.`
  const canonicalPath = `/collection/${params.id}`
  const image = collection.backdrop_path
    ? getImageURL(collection.backdrop_path)
    : undefined

  return {
    title: collection.name,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      title: collection.name,
      description,
      url: `${siteConfig.websiteURL}${canonicalPath}`,
      images: image
        ? [{ url: image, width: 1280, height: 720, alt: collection.name }]
        : undefined,
    },
  }
}

const CollectionPage = async (props: PageDetailsProps) => {
  const params = await props.params
  let collection
  try {
    collection = await getCollectionById(params.id)
  } catch {
    notFound()
  }
  if (!collection?.id) notFound()

  const parts = [...(collection.parts ?? [])].sort(byReleaseDate)

  return (
    <main className="relative">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Movies', url: '/movies' },
          { name: collection.name, url: `/collection/${params.id}` },
        ])}
      />

      {/* Backdrop header: fixed pixel heights (NOT dvh/aspect-ratio — those
          collapsed to a sliver and let the title collide with the fixed nav).
          A tall, bottom-aligned band keeps the title clear of the header and
          gives the backdrop room; slight cover-crop is fine for a text banner. */}
      {/* Height is an inline style, not a Tailwind class: this route is new and
          arbitrary/rare height utilities weren't landing in the served CSS
          bundle (scan/SW-cache gap), collapsing the banner to content height.
          Inline style is in the DOM directly, so it can't be dropped. */}
      <section
        className="relative isolate w-full overflow-hidden"
        style={{ height: '28rem' }}
      >
        {collection.backdrop_path && (
          <BlurredImage
            src={getImageURL(collection.backdrop_path)}
            alt={collection.name}
            fill
            sizes="100vw"
            className="object-cover object-center"
            intro
            priority
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
        <div className="relative z-10 container flex h-full max-w-(--breakpoint-2xl) flex-col justify-end pb-8 lg:pb-12">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-cyan-300 uppercase">
            <Layers className="size-3.5" aria-hidden />
            Collection
          </span>
          <h1 className="mt-2 text-2xl font-bold text-white lg:text-4xl">
            {collection.name}
          </h1>
          {collection.overview && (
            <p className="mt-3 max-w-3xl text-sm text-white/70 lg:text-base">
              {collection.overview}
            </p>
          )}
          <p className="mt-3 text-xs font-medium text-white/50">
            {parts.length} {pluralize(parts.length, 'title')}
          </p>
        </div>
      </section>

      <section className="container max-w-(--breakpoint-2xl) py-10 lg:py-14">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-8">
          {parts.map((movie) => (
            <Card
              key={movie.id}
              item={movie as MediaType}
              itemType="movie"
              isTruncateOverview={false}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

export default CollectionPage
