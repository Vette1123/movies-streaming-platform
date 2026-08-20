'use client'

import { Star } from 'lucide-react'

import { getPosterImageURL, itemRedirect } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaLink } from '@/components/media/media-link'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

export interface PosterTileItem {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  rating?: number | null
  note?: string | null
}

/**
 * A poster, its title, and whatever the person said about it.
 *
 * The shared-page tile: a published list and a public profile both print grids
 * of exactly this, and a tile that renders differently on one of them reads as
 * a bug rather than a variation. `sizes` is a prop because the two grids are
 * different widths, and it has to describe what the image PAINTS rather than
 * the box it sits in — see lib/image-loader.ts.
 */
export function PosterTile({
  item,
  sizes,
}: {
  item: PosterTileItem
  sizes: string
}) {
  const itemType = item.type === 'series' ? 'tv' : 'movie'
  const href = `${itemRedirect(itemType)}/${item.id}`

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
            sizes={sizes}
            className="aspect-2/3 w-full rounded-lg object-cover shadow-lg transition-shadow duration-500 group-hover/card:shadow-2xl"
          />
        ) : (
          <MediaPosterFallback itemType={itemType} title={item.title} />
        )}
      </MediaLink>

      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
        {item.rating != null && (
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
