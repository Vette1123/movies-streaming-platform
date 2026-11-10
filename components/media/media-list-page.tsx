import React, { Suspense } from 'react'
import Link from 'next/link'

import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'
import { toListEntries } from '@/lib/media'
import { MediaListPageConfig } from '@/lib/media-page'
import { QUERY_KEYS } from '@/lib/queryKeys'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'
import { MediaContent } from '@/components/media/media-content'
import { MediaListFallback } from '@/components/media/media-list-fallback'
import { yearRange } from '@/components/media/year-page'
import { SectionErrorBoundary } from '@/components/section-error-boundary'

/** Recent enough to be worth a link from the hub; the rest chain from there. */
const YEARS_LINKED = 8

interface HubLink {
  href: string
  label: string
}

/** A labelled row of hub links: prerendered anchors a crawler can follow. */
const HubLinkRow = ({
  label,
  ariaLabel,
  links,
}: {
  label: string
  ariaLabel: string
  links: HubLink[]
}) => (
  <nav
    aria-label={ariaLabel}
    className="flex flex-wrap items-center gap-2 text-sm"
  >
    <span className="text-muted-foreground">{label}</span>
    {links.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          chipVariants({ variant: 'neutral', interactive: 'subtle' }),
          'text-sm'
        )}
      >
        {link.label}
      </Link>
    ))}
  </nav>
)

interface MediaListPageProps {
  media: MediaResponse
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
  config: MediaListPageConfig
}

// Shared body for the /movies and /tv-shows browse pages — section shell,
// collection + breadcrumb JSON-LD, and the filterable infinite grid.
//
// The <h1> and the description live HERE, in the server component, not inside
// MediaContent: the filter subtree reads the URL via nuqs/useSearchParams and so
// bails to client-side rendering during the static prerender. Anything rendered
// inside it is absent from the HTML — which is why these two pages shipped with
// no heading and no crawlable content at all.
export const MediaListPage = ({
  media,
  queryKey,
  config,
}: MediaListPageProps) => {
  const url = `${siteConfig.websiteURL}${config.path}`
  const mediaType = queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'
  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({
          name: config.ogTitle,
          description: config.description,
          url,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: config.title, url: config.path },
        ])}
      />
      {/* What the page is actually listing. CollectionPage above says "this is
          a list"; only ItemList says what is in it, which is what a carousel
          result is built from. */}
      <JsonLd
        data={itemListJsonLd(toListEntries(media?.results ?? [], mediaType), {
          name: config.ogTitle,
          url: config.path,
        })}
      />
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {config.title}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{config.description}</p>
      </div>

      {/* The genre and year hubs, linked from the page that owns them. The
          filter sidebar can express the same queries, but it renders
          client-side into a URL robots.txt disallows; these are prerendered
          documents a crawler can follow. Before the genre row, the 35 genre
          hubs had no link from either browse page. Recent years only; the
          rest chain off any one of them. */}
      <div className="mb-8 space-y-3">
        <HubLinkRow
          label="By genre:"
          ariaLabel={`${config.title} by genre`}
          links={(mediaType === 'movie'
            ? MOVIE_GENRES_WITH_SLUG
            : TV_GENRES_WITH_SLUG
          ).map((genre) => ({
            href: `${config.path}/genre/${genre.slug}`,
            label: genre.name,
          }))}
        />
        <HubLinkRow
          label="By year:"
          ariaLabel={`${config.title} by year`}
          links={yearRange()
            .slice(0, YEARS_LINKED)
            .map((year) => ({
              href: `${config.path}/year/${year}`,
              label: String(year),
            }))}
        />
      </div>
      {/* The filter sidebar + infinite grid is the most failure-prone island in
          the app: it hydrates on the client (nuqs), calls Server Actions on
          every filter change, and lazy-loads chunks as you scroll. Keep those
          failures here instead of replacing the whole browse page — the h1 and
          the SEO markup above stay rendered. */}
      <SectionErrorBoundary
        section={`${mediaType}_list`}
        title="The list didn't load"
      >
        <Suspense
          fallback={<MediaListFallback media={media} mediaType={mediaType} />}
        >
          <MediaContent
            media={media}
            queryKey={queryKey}
            enableFilters={true}
            filterLayout="sidebar"
          />
        </Suspense>
      </SectionErrorBoundary>
    </section>
  )
}
