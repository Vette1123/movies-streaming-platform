'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { WatchedItem } from '@/hooks/use-local-storage'

export function WatchedBadge({ id }: { id: number }) {
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchedItems')
      if (stored) {
        const items: WatchedItem[] = JSON.parse(stored)
        setWatched(items.some((i) => i.id === id))
      }
    } catch {}
  }, [id])

  if (!watched) return null

  return (
    <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
      <CheckCircle2 className="size-3 text-green-400" />
      <span className="text-xs font-semibold text-green-400">Watched</span>
    </div>
  )
}
