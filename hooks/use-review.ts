'use client'

import { useCallback, useMemo } from 'react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import {
  buildWatchedItem,
  useLocalStorage,
  type WatchedItem,
} from '@/hooks/use-local-storage'

/**
 * Your own score, on any title.
 *
 * Reely has always known what you watched and never what you thought of it —
 * the only ratings in the app were TMDB's average and the per-item score inside
 * a list, which is a different thing (a list is a curation, not a verdict).
 *
 * Stored in the `reviews` store so it rides the existing sync engine: one row
 * per title, last write wins, tombstoned on clear, and on every device the
 * moment it is saved. Nothing here is a new table, a new endpoint or a new
 * conflict rule.
 */
const STORE = 'reviews'

/** TMDB's own scale, so a 7 here means what a 7 means everywhere else on the page. */
export const MIN_RATING = 1
export const MAX_RATING = 10
export const MAX_NOTE = 500

export interface ReviewState {
  rating: number | null
  note: string
  /** Write a score and an optional note. */
  save: (rating: number, note: string) => void
  /** Remove the review entirely, rather than storing a zero. */
  clear: () => void
}

/** One decimal place, inside the scale, or null for anything else. */
export function normaliseRating(value: number): number | null {
  if (!Number.isFinite(value)) return null
  const clamped = Math.min(MAX_RATING, Math.max(MIN_RATING, value))
  return Math.round(clamped * 10) / 10
}

export function useReview(media: MovieDetails | SeriesDetails): ReviewState {
  const [reviews, setReviews] = useLocalStorage(STORE, [])

  const existing = useMemo(
    () => reviews.find((item: WatchedItem) => item.id === media?.id) ?? null,
    [reviews, media?.id]
  )

  const save = useCallback(
    (rating: number, note: string) => {
      const score = normaliseRating(rating)
      if (score === null) return

      const now = new Date().toISOString()
      const base = buildWatchedItem(media)
      const trimmed = note.trim().slice(0, MAX_NOTE)

      const next: WatchedItem = {
        ...base,
        // The first save is when this opinion was formed; later ones only move
        // modified_at, which is what the sync engine resolves conflicts on.
        added_at: existing?.added_at ?? now,
        modified_at: now,
        rating: score,
      }
      if (trimmed) next.note = trimmed

      setReviews([
        ...reviews.filter((item: WatchedItem) => item.id !== media.id),
        next,
      ])
    },
    [existing?.added_at, media, reviews, setReviews]
  )

  const clear = useCallback(() => {
    if (!existing) return
    setReviews(reviews.filter((item: WatchedItem) => item.id !== media.id))
  }, [existing, media, reviews, setReviews])

  return {
    rating: existing?.rating ?? null,
    note: existing?.note ?? '',
    save,
    clear,
  }
}
