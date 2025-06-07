import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
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
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {item?.poster_path && (
          <Link href={`${itemRedirect(itemType)}/${item.id}`}>
            <motion.div
              initial="rest"
              whileHover="hover"
              animate="rest"
              className="pointer-events-none lg:pointer-events-auto"
            >
              <motion.div className="group relative" variants={CARD_VARIANT}>
                <BlurredImage
                  src={`${getPosterImageURL(item.poster_path)}`}
                  alt="Movie"
                  width={250}
                  height={375}
                  className="cursor-pointer rounded-md object-cover shadow-xl"
                />
              </motion.div>
            </motion.div>
          </Link>
        )}
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
                {item?.title} ({item?.release_date?.slice(0, 4)})
              </h4>
              <Badge>{numberRounder(item.vote_average)}</Badge>
            </div>
            <p className="text-sm">
              {isTruncateOverview && item.overview.length > 100 ? (
                <>{item.overview.slice(0, 100)}...</>
              ) : (
                item.overview.slice(0, 400)
              )}
            </p>
            <div className="flex items-center pt-2">
              <CalendarDays className="mr-2 size-4 opacity-70" />{' '}
              <span className="text-xs text-muted-foreground">
                {dateFormatter(item?.release_date, true)}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
