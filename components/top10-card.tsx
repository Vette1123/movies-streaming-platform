'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { CARD_VARIANT } from '@/lib/motion-variants'
import { getPosterImageURL, itemRedirect, numberRounder } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { FavoriteButton } from '@/components/favorite-button'
import { WatchedBadge } from '@/components/watched-badge'

interface Top10CardProps {
  item: MediaType
  rank: number
  itemType?: ItemType
}

export function Top10Card({ item, rank, itemType = 'movie' }: Top10CardProps) {
  if (!item?.poster_path) return null

  return (
    <div className="relative flex items-end">
      {/* Big outlined number */}
      <span
        className="select-none text-[130px] font-black leading-none text-transparent"
        style={{ WebkitTextStroke: '2px rgba(255,255,255,0.18)' }}
      >
        {rank}
      </span>
      {/* Poster overlapping the number */}
      <div className="-ml-5 w-[115px] shrink-0">
        <Link href={`${itemRedirect(itemType)}/${item.id}`}>
          <motion.div initial="rest" whileHover="hover" animate="rest">
            <motion.div className="group relative" variants={CARD_VARIANT}>
              <div className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10">
                <BlurredImage
                  src={getPosterImageURL(item.poster_path)}
                  alt={item.title || 'Media poster'}
                  width={115}
                  height={172}
                  className="w-full cursor-pointer object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {item.vote_average > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-yellow-400 backdrop-blur-sm">
                    <Star className="size-3 fill-yellow-400" />
                    {numberRounder(item.vote_average)}
                  </div>
                )}
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
              <p className="mt-1.5 truncate text-xs font-medium leading-tight">
                {item.title}
              </p>
            </motion.div>
          </motion.div>
        </Link>
      </div>
    </div>
  )
}
