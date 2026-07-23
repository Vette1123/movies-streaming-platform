import React from 'react'
import Link from 'next/link'
import { Clapperboard, Film, Tv } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { getPosterImageURL, itemRedirect } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

interface StaticRailProps {
  title: string
  items: MediaType[]
  itemType?: ItemType
}

/**
 * Zero-interactivity twin of <List>. Same outer <nav>, heading, gutter, poster
 * dimensions and native scroll container — but plain <a>/<Image> posters with no
 * framer heading, no radix HoverCard, no drag handlers, no arrow chrome. It is
 * what the server renders (and what the client renders on first paint) for a
 * below-fold rail, so the SSR HTML keeps every poster link + alt text (SEO) and
 * reserves the exact box (CLS), while none of List's per-card client machinery
 * hydrates until <LazyRail> swaps the real List in near the viewport.
 *
 * Poster URLs go through the same getPosterImageURL + next/image path as Card,
 * so the swap is a cache hit with no reflash. Kept visually identical to List's
 * resting state (accent bar + title, "Explore All" is hover-only there anyway).
 */
export function StaticRail({ title, items, itemType = 'movie' }: StaticRailProps) {
  return (
    <nav className="cv-auto px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 xl:px-16 2xl:px-20">
      <Link
        href={itemRedirect(itemType)}
        prefetch={false}
        className="mb-4 flex w-fit items-center gap-2"
      >
        <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span
            aria-hidden
            className="h-5 w-[3px] origin-center rounded-full bg-gradient-to-b from-cyan-300 to-cyan-500 shadow-[0_0_8px_rgba(103,232,249,0.5)]"
          />
          {title}
        </h2>
      </Link>

      {items.length === 0 && (
        <div
          role="status"
          className="text-muted-foreground border-border/60 flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm"
        >
          <Clapperboard className="size-4 shrink-0 opacity-70" />
          Nothing to show here yet — check back soon.
        </div>
      )}

      {items.length > 0 && (
        <div className="no-scrollbar -my-4 flex snap-x snap-mandatory gap-6 overflow-x-auto py-4">
          {items.map((item) => {
            const posterTitle = item?.title || item?.name || 'Poster'
            return (
              <div
                key={item.id}
                className="w-[160px] shrink-0 snap-start sm:w-[190px] lg:w-[230px] 2xl:w-[250px]"
              >
                <Link
                  href={`${itemRedirect(itemType)}/${item.id}`}
                  prefetch={false}
                  className="block w-full"
                >
                  {item?.poster_path ? (
                    // Same BlurredImage as Card, so below-fold posters get the
                    // identical reserved box + dark-crossfade reveal (and the swap
                    // to the interactive List is a same-URL cache hit, no reflash).
                    <div className="rounded-lg shadow-lg">
                      <BlurredImage
                        src={getPosterImageURL(item.poster_path)}
                        alt={posterTitle}
                        width={250}
                        height={375}
                        className="rounded-lg object-cover"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted text-muted-foreground flex aspect-2/3 w-full flex-col items-center justify-center gap-2 rounded-lg p-4 text-center shadow-lg">
                      {itemType === 'tv' ? (
                        <Tv className="size-8 opacity-60" aria-hidden />
                      ) : (
                        <Film className="size-8 opacity-60" aria-hidden />
                      )}
                      <span className="line-clamp-3 text-xs font-medium">
                        {posterTitle}
                      </span>
                    </div>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </nav>
  )
}
