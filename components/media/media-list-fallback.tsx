import React from 'react'

import { MediaResponse, MediaType } from '@/types/media'
import { Card } from '@/components/card'

interface MediaListFallbackProps {
  media: MediaResponse
  mediaType: 'movie' | 'tv'
}

// What the browse list ships in the HTML while its filter subtree hydrates.
//
// FilteredMediaContent reads the filter state from the URL (nuqs →
// useSearchParams), which under a static prerender bails its Suspense boundary
// to client-side rendering. Whatever this renders is therefore the ONLY markup
// a crawler (or a JS-less client) ever sees for /movies and /tv-shows — so it
// renders the real first page of results, not a skeleton. That restores the
// page's crawlable text and its internal links to every detail page.
//
// The wrapper mirrors FilteredMediaContent's sidebar layout so hydration swaps
// the grid in place instead of reflowing it.
export const MediaListFallback = ({
  media,
  mediaType,
}: MediaListFallbackProps) => (
  <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
    <div aria-hidden className="hidden w-80 flex-shrink-0 lg:block xl:w-96">
      <div className="bg-card/40 h-[40rem] w-full rounded-xl border" />
    </div>
    <div className="min-w-0 flex-1">
      <div
        aria-hidden
        className="bg-muted/50 mb-6 h-10 w-32 rounded-md lg:hidden"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {media?.results?.map((item) => (
          <Card
            key={item.id}
            item={item as MediaType}
            itemType={mediaType}
            isTruncateOverview={false}
          />
        ))}
      </div>
    </div>
  </div>
)
