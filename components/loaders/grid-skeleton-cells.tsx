import React from 'react'

interface GridSkeletonCellsProps {
  count?: number
}

// Bare poster-aspect placeholder cells meant to sit INSIDE an existing results
// grid while the next page is in flight — no grid wrapper, no text lines (unlike
// MediaGridSkeleton). Reserving the cells keeps the footer from lurching as
// skeleton → real cards swap in cell-for-cell.
export const GridSkeletonCells = ({ count = 10 }: GridSkeletonCellsProps) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={`skeleton-${i}`}
        className="bg-muted/70 aspect-[2/3] w-full animate-pulse rounded-lg"
      />
    ))}
  </>
)
