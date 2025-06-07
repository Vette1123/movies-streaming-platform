import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Film, Tv } from 'lucide-react'

import { dateFormatter, getPosterImageURL } from '@/lib/utils'
import { WatchedItem } from '@/hooks/use-local-storage'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

import { BlurredImage } from '../blurred-image'

interface WatchedItemCardProps {
  item: WatchedItem
}

const CARD_VARIANT = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
}

export function WatchedItemCard({ item }: WatchedItemCardProps) {
  const handleRedirect = () => {
    if (item.type === 'movie') {
      return `/movies/${item.id}`
    }
    return `/tv-shows/${item.id}?season=${item.season}&episode=${item.episode}`
  }

  return (
    <Link href={handleRedirect()} className="h-fit">
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
              <div className="absolute right-2 top-2">
                <Badge variant="secondary">
                  {item.type === 'movie' ? (
                    <Film className="size-4" />
                  ) : (
                    <Tv className="size-4" />
                  )}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="truncate font-semibold">{item.title}</h3>
                {item.type === 'series' && (
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    S{item.season}, E{item.episode}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center text-xs text-muted-foreground">
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
