import React from 'react'
import { Layers } from 'lucide-react'

import { CollectionDetails } from '@/types/collection'
import { MediaType } from '@/types/media'
import { Movie } from '@/types/movie-result'
import { toListEntries } from '@/lib/media'
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from '@/lib/structured-data'
import { getImageURL, pluralize } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { Card } from '@/components/card'

// The whole collection page, minus the data fetch.
//
// Two callers render it: the prerendered app/collection/[id] route (on the
// server, at build) and app/collection-fallback (in the browser, for a
// franchise id the build did not bake). Deliberately free of server-only
// imports so the same file works in both.

// Chronological franchise order (earliest first); undated entries sort last so a
// not-yet-released sequel doesn't jump the row.
const byReleaseDate = (a: Movie, b: Movie) => {
  const da = a.release_date || '9999'
  const db = b.release_date || '9999'
  return da.localeCompare(db)
}

export function CollectionView({
  collection,
}: {
  collection: CollectionDetails
}) {
  const parts = React.useMemo(
    () => [...(collection.parts ?? [])].sort(byReleaseDate),
    [collection.parts]
  )

  return (
    <main className="relative">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Movies', url: '/movies' },
          { name: collection.name, url: `/collection/${collection.id}` },
        ])}
      />
      {/* The films in the franchise, in the order the page shows them — a
          collection page that does not say what it collects is a list Google
          has to guess at. */}
      <JsonLd
        data={itemListJsonLd(toListEntries(parts, 'movie'), {
          name: collection.name,
          url: `/collection/${collection.id}`,
        })}
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
            // The band is a fixed 448px tall and `object-cover`, so below a
            // ~800px viewport the HEIGHT binds and the backdrop paints ~797 CSS
            // px wide however narrow the screen gets — `100vw` under-described
            // that by 2x on a phone (measured: a 1200px file across 2393 device
            // px). The 640px clause is the same deliberate brake the heroes use;
            // see lib/image-sizes.ts.
            sizes="(max-width: 640px) 160vw, (max-width: 800px) 800px, 100vw"
            className="object-cover object-center"
            intro
            // Eager + high rather than `priority`: same fetch, no WebP preload
            // tag, which is what lets this take the AVIF <source> like the two
            // heroes do (measured there at 110 KB -> 65 KB). See
            // components/header/hero-image.tsx.
            loading="eager"
            fetchPriority="high"
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
