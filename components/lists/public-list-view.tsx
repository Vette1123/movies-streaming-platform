'use client'

import { Star } from 'lucide-react'

import type { ListItem, PublicList } from '@/lib/lists/routes'
import { getPosterImageURL, itemRedirect } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaLink } from '@/components/media/media-link'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

/**
 * A published list, as a stranger sees it.
 *
 * The Worker renders the title, description, OG tags and JSON-LD for this page
 * server-side (see `handleListPage`) and hands over this shell to draw the
 * items, so an unfurl and a crawler get the real thing and the visitor gets the
 * posters. Both halves read the same row through `loadPublicList`, which is what
 * stops the page and its preview disagreeing.
 */
export function PublicListView({ list }: { list: PublicList }) {
  const count = list.items.length

  return (
    <div className="container max-w-6xl py-20 lg:py-28">
      <header className="mb-10 max-w-3xl space-y-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          {list.owner ? `A list by ${list.owner}` : 'A list on Reely'}
        </p>
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {list.name}
        </h1>
        {list.description && (
          <p className="text-muted-foreground max-w-[65ch] leading-relaxed">
            {list.description}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {count} {count === 1 ? 'title' : 'titles'}
        </p>
      </header>

      {count === 0 ? (
        <p className="text-muted-foreground">
          There is nothing in this list yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.items.map((item) => (
            <li key={`${item.type}:${item.id}`}>
              <ListPoster item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListPoster({ item }: { item: ListItem }) {
  const href = `${itemRedirect(item.type === 'series' ? 'tv' : 'movie')}/${item.id}`
  const itemType = item.type === 'series' ? 'tv' : 'movie'

  return (
    <article className="space-y-2">
      <MediaLink
        href={href}
        className="group/card block"
        aria-label={item.title}
      >
        {item.poster_path ? (
          <BlurredImage
            src={getPosterImageURL(item.poster_path)}
            alt={item.title}
            width={500}
            height={750}
            quality={POSTER_QUALITY}
            // The tile is one column of a 2/3/4/5-up grid inside a 72rem
            // container, and `sizes` has to describe what the image PAINTS, not
            // the box it sits in — see lib/image-loader.ts.
            sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
            className="aspect-2/3 w-full rounded-lg object-cover shadow-lg transition-shadow duration-500 group-hover/card:shadow-2xl"
          />
        ) : (
          <MediaPosterFallback itemType={itemType} title={item.title} />
        )}
      </MediaLink>

      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
        {item.rating !== undefined && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {item.rating}/10
          </p>
        )}
        {item.note && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {item.note}
          </p>
        )}
      </div>
    </article>
  )
}
