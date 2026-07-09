import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Film, Tv, X } from 'lucide-react'

import { trackWatchHistoryItemClicked } from '@/lib/analytics'
import { dateFormatter, getPosterImageURL } from '@/lib/utils'
import { WatchedItem } from '@/hooks/use-local-storage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

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
  const handleRedirect = () => {
    if (item.type === 'movie') {
      return `/movies/${item.id}`
    }
    // Watchlist items are saved without a season/episode; only deep-link to a
    // specific episode when we actually have one (watch-history items do).
    if (item.season && item.episode) {
      return `/tv-shows/${item.id}?season=${item.season}&episode=${item.episode}`
    }
    return `/tv-shows/${item.id}`
  }

  return (
    <Link
      href={handleRedirect()}
      // Watch-history is a full grid; viewport auto-prefetch would fire one RSC
      // request per watched item at once. Prefetch on hover only (page is
      // personal/noindex, so eager prefetch isn't worth the rate-limit risk).
      prefetch={false}
      className="group h-fit"
      onClick={() =>
        trackWatchHistoryItemClicked({
          media_id: item.id,
          media_type: item.type === 'movie' ? 'movie' : 'tv',
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
                  {item.type === 'movie' ? (
                    <Film className="size-4" />
                  ) : (
                    <Tv className="size-4" />
                  )}
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
                {item.type === 'series' && (
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
    </Link>
  )
}
