'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Film, Tv } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { trackMediaCardClicked } from '@/lib/analytics'
import { CARD_VARIANT } from '@/lib/motion-variants'
import {
  dateFormatter,
  getPosterImageURL,
  itemRedirect,
  numberRounder,
} from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BlurredImage } from '@/components/blurred-image'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

interface CardProps {
  item: MediaType
  itemType?: ItemType
  isTruncateOverview?: boolean
}

export const Card = ({
  item,
  itemType = 'movie',
  isTruncateOverview = true,
}: CardProps) => {
  const title = item?.title || item?.name
  const releaseDate = item?.release_date || item?.first_air_date
  const year = releaseDate?.slice(0, 4)
  const overview = item?.overview ?? ''

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={`${itemRedirect(itemType)}/${item.id}`}
          // Viewport auto-prefetch fires one RSC request per card; a homepage
          // of carousels mounts 100+ cards at once and trips the CF rate-limit
          // (100 req/10s on detail paths) → 1015 on our own page load. Prefetch
          // on hover only — pairs with the HoverCard, keeps nav snappy.
          prefetch={false}
          onClick={() =>
            trackMediaCardClicked({
              media_id: item.id,
              media_type: itemType === 'tv' ? 'tv' : 'movie',
              title,
              source: 'card',
            })
          }
        >
          <motion.div
            initial="rest"
            whileHover="hover"
            animate="rest"
            className="pointer-events-none lg:pointer-events-auto"
          >
            <motion.div className="group relative" variants={CARD_VARIANT}>
              <NewBadgeWhenRecent date={releaseDate} />
              {item?.poster_path ? (
                <BlurredImage
                  src={`${getPosterImageURL(item.poster_path)}`}
                  alt={title ?? 'Poster'}
                  width={250}
                  height={375}
                  className="cursor-pointer rounded-md object-cover shadow-xl"
                />
              ) : (
                <div className="bg-muted text-muted-foreground flex aspect-2/3 w-[250px] max-w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md p-4 text-center shadow-xl">
                  {itemType === 'tv' ? (
                    <Tv className="size-8 opacity-60" aria-hidden />
                  ) : (
                    <Film className="size-8 opacity-60" aria-hidden />
                  )}
                  <span className="line-clamp-3 text-xs font-medium">
                    {title}
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="hidden w-80 md:block" side="right">
        <div className="flex justify-between space-x-4">
          <Avatar>
            <AvatarImage src="/personal-logo.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                {title}
                {year ? ` (${year})` : ''}
              </h4>
              <Badge>{numberRounder(item.vote_average)}</Badge>
            </div>
            <p className="text-sm">
              {isTruncateOverview && overview.length > 100
                ? `${overview.slice(0, 100)}...`
                : overview.slice(0, 400)}
            </p>
            <div className="flex items-center pt-2">
              <CalendarDays className="mr-2 size-4 opacity-70" />{' '}
              <span className="text-muted-foreground text-xs">
                {dateFormatter(releaseDate ?? '', true)}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
