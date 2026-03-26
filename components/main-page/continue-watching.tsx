'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Film, Play, Tv } from 'lucide-react'

import { WatchedItem } from '@/hooks/use-local-storage'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export const ContinueWatching = () => {
  const [items, setItems] = useState<WatchedItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchedItems')
      if (stored) {
        const parsed: WatchedItem[] = JSON.parse(stored)
        setItems(
          parsed
            .sort(
              (a, b) =>
                new Date(b.modified_at).getTime() -
                new Date(a.modified_at).getTime()
            )
            .slice(0, 12)
        )
      }
    } catch {}
  }, [])

  if (!items.length) return null

  return (
    <nav className="py-10">
      <h2 className="mb-4 text-2xl font-bold">Continue Watching</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={
              item.type === 'series'
                ? `/tv-shows/${item.id}?season=${item.season || 1}&episode=${item.episode || 1}`
                : `/movies/${item.id}`
            }
            className="group flex-shrink-0"
          >
            <div className="relative h-[225px] w-[150px] overflow-hidden rounded-lg shadow-xl">
              <BlurredImage
                src={getPosterImageURL(item.poster_path)}
                alt={item.title}
                fill
                intro
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="150px"
              />
              {/* gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {/* play icon on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                  <Play className="size-5 fill-white text-white" />
                </div>
              </div>
              {/* type badge — top-left */}
              <div className="absolute left-2 top-2 rounded-full bg-black/60 p-1.5 backdrop-blur-sm">
                {item.type === 'movie' ? (
                  <Film className="size-3 text-white/80" />
                ) : (
                  <Tv className="size-3 text-white/80" />
                )}
              </div>
              {/* episode badge — bottom-left */}
              {item.type === 'series' && item.season && (
                <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
                  <span className="text-xs font-semibold text-white">
                    S{item.season} E{item.episode}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-1.5 w-[150px] truncate text-sm font-medium">
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </nav>
  )
}
