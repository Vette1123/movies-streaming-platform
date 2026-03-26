'use client'

import React, { useEffect, useState } from 'react'

import { getRecommendationsAction } from '@/actions/recommendations'
import { WatchedItem } from '@/hooks/use-local-storage'
import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { List } from '@/components/list'

export const BecauseYouWatched = () => {
  const [title, setTitle] = useState('')
  const [recommendations, setRecommendations] = useState<MediaType[]>([])
  const [itemType, setItemType] = useState<ItemType>('movie')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('watchedItems')
      if (!stored) return
      const items: WatchedItem[] = JSON.parse(stored)
      if (!items.length) return

      const latest = items.sort(
        (a, b) =>
          new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
      )[0]

      setTitle(latest.title)
      setItemType(latest.type === 'series' ? 'tv' : 'movie')

      getRecommendationsAction({ id: latest.id, type: latest.type }).then(
        (data) => {
          if (data?.results?.length) setRecommendations(data.results)
        }
      )
    } catch {}
  }, [])

  if (!recommendations.length) return null

  return (
    <List
      title={`Because you watched ${title}`}
      items={recommendations}
      itemType={itemType}
    />
  )
}
