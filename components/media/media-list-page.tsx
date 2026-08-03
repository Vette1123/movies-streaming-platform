import React, { Suspense } from 'react'

import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import { MediaListPageConfig } from '@/lib/media-page'
import { QUERY_KEYS } from '@/lib/queryKeys'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { MediaContent } from '@/components/media/media-content'
import { MediaListFallback } from '@/components/media/media-list-fallback'
import { SectionErrorBoundary } from '@/components/section-error-boundary'

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
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {config.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{config.description}</p>
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
