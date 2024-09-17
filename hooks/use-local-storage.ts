import { useEffect, useState } from 'react'

export interface WatchedItem {
  id: number
  type: 'movie' | 'series'
  title: string
  overview: string
  backdrop_path: string
  poster_path: string
  season?: number
  episode?: number
  added_at: string
  modified_at: string
}

export function useLocalStorage(key: string, initialValue: WatchedItem[] = []) {
  const [storedValue, setStoredValue] = useState<WatchedItem[]>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }, [key, storedValue])

  return [storedValue, setStoredValue] as const
}
