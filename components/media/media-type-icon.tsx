import { Film, Tv } from 'lucide-react'

import { ItemType } from '@/types/movie-result'

// Decorative movie/TV glyph. One place picks Film vs Tv so the choice can't
// drift between the poster fallback, list cards, and history badges.
export function MediaTypeIcon({
  type,
  className,
}: {
  type: ItemType
  className?: string
}) {
  const Icon = type === 'tv' ? Tv : Film
  return <Icon className={className} aria-hidden />
}
