'use client'

import { useEffect, useState } from 'react'

export interface FavoriteItem {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string
  release_date?: string
  vote_average?: number
  added_at: string
}

const STORAGE_KEY = 'favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setFavorites(JSON.parse(stored))
    } catch {}
  }, [])

  const save = (items: FavoriteItem[]) => {
    setFavorites(items)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }

  const toggle = (item: Omit<FavoriteItem, 'added_at'>) => {
    const exists = favorites.some((f) => f.id === item.id)
    if (exists) {
      save(favorites.filter((f) => f.id !== item.id))
    } else {
      save([...favorites, { ...item, added_at: new Date().toISOString() }])
    }
  }

  const isFavorite = (id: number) => favorites.some((f) => f.id === id)
  const clearAll = () => save([])

  return { favorites, toggle, isFavorite, clearAll, mounted }
}
