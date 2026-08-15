import React from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, X } from 'lucide-react'

import {
  toAnalyticsMediaType,
  trackWatchHistoryItemClicked,
} from '@/lib/analytics'
import { mediaDetailHref } from '@/lib/media'
import { dateFormatter, getPosterImageURL } from '@/lib/utils'
import { WatchedItem } from '@/hooks/use-local-storage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MediaLink } from '@/components/media/media-link'
import { MediaTypeIcon } from '@/components/media/media-type-icon'

import { BlurredImage } from '../blurred-image'

interface WatchedItemCardProps {
  item: WatchedItem
  // When provided, a remove control is shown on the card (used by /watchlist so
  // the page is self-sufficient — no need to open the detail page to un-save).
  onRemove?: (id: number) => void
}

const CARD_VARIANT = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
}

export function WatchedItemCard({ item, onRemove }: WatchedItemCardProps) {
  const buildHref = () => {
    const href = mediaDetailHref(toAnalyticsMediaType(item.type), item.id)
    // Watchlist items are saved without a season/episode; only deep-link to a
    // specific episode when we actually have one (watch-history items do).
    if (item.type !== 'movie' && item.season && item.episode) {
      return `${href}?season=${item.season}&episode=${item.episode}`
    }
    return href
  }

  const href = buildHref()

  return (
    <MediaLink
      href={href}
      className="group h-fit"
      onClick={() =>
        trackWatchHistoryItemClicked({
          media_id: item.id,
          media_type: toAnalyticsMediaType(item.type),
          title: item.title,
        })
      }
    >
      <motion.div initial="rest" whileHover="hover" animate="rest">
        <motion.div variants={CARD_VARIANT}>
          <Card className="overflow-hidden">
            <div className="relative aspect-2/3 w-full">
              <BlurredImage
                src={`${getPosterImageURL(item.poster_path)}`}
                width={250}
                alt={item.title}
                height={375}
                className="cursor-pointer rounded-md object-cover shadow-xl"
              />
              <div className="absolute top-2 right-2">
                <Badge variant="secondary">
                  <MediaTypeIcon
                    type={toAnalyticsMediaType(item.type)}
                    className="size-4"
                  />
                </Badge>
              </div>
              {onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${item.title} from watchlist`}
                  onClick={(e) => {
                    // The card is a <Link>; stop the click from navigating.
                    e.preventDefault()
                    e.stopPropagation()
                    onRemove(item.id)
                  }}
                  className="absolute top-2 left-2 grid size-7 cursor-pointer place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:scale-110 hover:bg-black/80 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="truncate font-semibold">{item.title}</h3>
                {/* Both, not just the type: a series SAVED rather than watched
                    carries no episode, and this printed a bare "S, E" at it. */}
                {item.type === 'series' &&
                  item.season !== undefined &&
                  item.episode !== undefined && (
                    <span className="text-muted-foreground ml-2 shrink-0 text-xs">
                      S{item.season}, E{item.episode}
                    </span>
                  )}
              </div>
              <div className="text-muted-foreground mt-2 flex items-center text-xs">
                <CalendarDays className="mr-1 size-3" />
                {dateFormatter(item.added_at, true)}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </MediaLink>
  )
}
