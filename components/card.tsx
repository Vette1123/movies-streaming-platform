import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Film, Star, Tv } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { CARD_VARIANT } from '@/lib/motion-variants'
import { cn, getPosterImageURL, itemRedirect, numberRounder } from '@/lib/utils'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BlurredImage } from '@/components/blurred-image'
import { FavoriteButton } from '@/components/favorite-button'
import { WatchedBadge } from '@/components/watched-badge'

interface CardProps {
  item: MediaType
  itemType?: ItemType
  isTruncateOverview?: boolean
}

function getRatingColor(rating: number) {
  if (rating >= 7) return 'text-green-400'
  if (rating >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function getRatingFill(rating: number) {
  if (rating >= 7) return 'fill-green-400'
  if (rating >= 5) return 'fill-yellow-400'
  return 'fill-red-400'
}

function isNewRelease(releaseDate: string) {
  if (!releaseDate) return false
  const diff = new Date().getTime() - new Date(releaseDate).getTime()
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000
}

export const Card = ({
  item,
  itemType = 'movie',
  isTruncateOverview = true,
}: CardProps) => {
  const ratingColor = getRatingColor(item.vote_average)
  const ratingFill = getRatingFill(item.vote_average)
  const isNew = isNewRelease(item.release_date)

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {item?.poster_path && (
          <div className="relative w-[150px] sm:w-[170px]">
            <Link href={`${itemRedirect(itemType)}/${item.id}`}>
              <motion.div
                initial="rest"
                whileHover="hover"
                animate="rest"
                className="pointer-events-none lg:pointer-events-auto"
              >
                <motion.div className="group relative" variants={CARD_VARIANT}>
                  <div className="relative overflow-hidden rounded-lg">
                    <BlurredImage
                      src={getPosterImageURL(item.poster_path)}
                      alt={item.title || 'Media poster'}
                      width={170}
                      height={255}
                      className="w-full cursor-pointer object-cover shadow-xl"
                    />
                    {/* Bottom gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {/* "NEW" badge — top-left */}
                    {isNew && (
                      <div className="absolute left-2 top-2 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        New
                      </div>
                    )}
                    {/* Rating badge — bottom-left, color-coded */}
                    {item.vote_average > 0 && (
                      <div
                        className={cn(
                          'absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm',
                          ratingColor
                        )}
                      >
                        <Star className={cn('size-3', ratingFill)} />
                        {numberRounder(item.vote_average)}
                      </div>
                    )}
                    {/* Favourite + watched — scale with the card */}
                    <FavoriteButton
                      item={{
                        id: item.id,
                        type: itemType === 'tv' ? 'series' : 'movie',
                        title: item.title,
                        poster_path: item.poster_path,
                        release_date: item.release_date,
                        vote_average: item.vote_average,
                      }}
                    />
                    <WatchedBadge id={item.id} />
                  </div>
                  {/* Title + year + type */}
                  <div className="mt-1.5 flex items-start justify-between gap-1">
                    <p className="min-w-0 truncate text-sm font-medium leading-tight">
                      {item.title}
                    </p>
                    {itemType === 'tv' ? (
                      <Tv className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <Film className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  {item.release_date && (
                    <p className="text-xs text-muted-foreground">
                      {item.release_date.slice(0, 4)}
                    </p>
                  )}
                </motion.div>
              </motion.div>
            </Link>
          </div>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="hidden w-72 md:block" side="right">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {item?.title}
                {item?.release_date && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({item.release_date.slice(0, 4)})
                  </span>
                )}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {itemType === 'tv' ? (
                  <Tv className="size-3" />
                ) : (
                  <Film className="size-3" />
                )}
                <span>{itemType === 'tv' ? 'TV Show' : 'Movie'}</span>
              </div>
            </div>
            {item.vote_average > 0 && (
              <div
                className={cn(
                  'flex shrink-0 items-center gap-1 text-xs font-semibold',
                  ratingColor
                )}
              >
                <Star className={cn('size-3', ratingFill)} />
                {numberRounder(item.vote_average)}
              </div>
            )}
          </div>
          {item.overview && (
            <p className="text-xs text-muted-foreground">
              {isTruncateOverview && item.overview.length > 120
                ? item.overview.slice(0, 120) + '…'
                : item.overview.slice(0, 400)}
            </p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
