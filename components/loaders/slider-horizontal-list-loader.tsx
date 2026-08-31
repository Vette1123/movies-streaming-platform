import React from 'react'

import { SkeletonContainer } from '../ui/skeleton'

// Mirrors the real row (full-bleed padding, accent-bar heading, tall 2:3 posters
// in a horizontal strip) so the Suspense fallback resolves into content without a
// width/shape jump.
export const SliderHorizontalListLoader = () => {
  return (
    <div className="w-full px-5 py-6 sm:p-8 lg:px-12 lg:py-10 xl:px-16 2xl:px-20">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-5 w-[3px] rounded-full bg-muted" />
        <div className="h-6 w-44 rounded-lg bg-muted" />
      </div>
      <div className="flex gap-6 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonContainer key={i}>
            <div className="aspect-2/3 w-40 shrink-0 rounded-lg bg-muted/80 sm:w-[190px] lg:w-[230px] 2xl:w-[250px]" />
          </SkeletonContainer>
        ))}
      </div>
    </div>
  )
}
