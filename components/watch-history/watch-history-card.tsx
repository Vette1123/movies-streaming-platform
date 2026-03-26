'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Film, Tv, X } from 'lucide-react'

import { dateFormatter, getPosterImageURL } from '@/lib/utils'
import { WatchedItem } from '@/hooks/use-local-storage'
import { BlurredImage } from '@/components/blurred-image'

interface WatchedItemCardProps {
  item: WatchedItem
  onDelete?: (id: number) => void
}

const CARD_VARIANT = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
}

export function WatchedItemCard({ item, onDelete }: WatchedItemCardProps) {
  const href =
    item.type === 'movie'
      ? `/movies/${item.id}`
      : `/tv-shows/${item.id}?season=${item.season}&episode=${item.episode}`

  return (
    <div className="group relative w-[150px] sm:w-[170px]">
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onDelete(item.id)
          }}
          className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-black/70 text-white/70 opacity-0 ring-1 ring-white/10 backdrop-blur-sm transition-all hover:text-white group-hover:opacity-100"
          aria-label="Remove from history"
        >
          <X className="size-3.5" />
        </button>
      )}
      <Link href={href} className="block">
        <motion.div initial="rest" whileHover="hover" animate="rest">
          <motion.div variants={CARD_VARIANT}>
            <div className="relative overflow-hidden rounded-lg">
              <BlurredImage
                src={getPosterImageURL(item.poster_path)}
                alt={item.title}
                width={170}
                height={255}
                className="w-full cursor-pointer object-cover shadow-xl"
              />
              {/* gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {/* type badge top-left */}
              <div className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 backdrop-blur-sm">
                {item.type === 'movie' ? (
                  <Film className="size-3 text-white/80" />
                ) : (
                  <Tv className="size-3 text-white/80" />
                )}
              </div>
              {/* series episode bottom-left */}
              {item.type === 'series' && item.season && (
                <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-white">
                    S{item.season} E{item.episode}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {dateFormatter(item.modified_at, true)}
            </p>
          </motion.div>
        </motion.div>
      </Link>
    </div>
  )
}
