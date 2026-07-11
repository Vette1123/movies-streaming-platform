'use server'

import { getGenreList } from '@/services/genres'

import { ItemType } from '@/types/movie-result'

// Thin server action so client components (e.g. the filter sidebar) can read the
// long-cached, fail-soft genre list without importing server-only code.
export async function getGenreListAction(mediaType: ItemType) {
  return getGenreList(mediaType)
}
