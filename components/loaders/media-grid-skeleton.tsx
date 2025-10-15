import React from 'react'

import { SkeletonContainer } from '@/components/ui/skeleton'

interface MediaGridSkeletonProps {
  count?: number
}

export const MediaGridSkeleton = ({ count = 20 }: MediaGridSkeletonProps) => {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonContainer key={i}>
          <div className="space-y-3">
            <div className="aspect-[2/3] rounded-lg bg-muted/80" />
            <div className="h-3 w-11/12 rounded-lg bg-muted" />
            <div className="h-3 w-8/12 rounded-lg bg-muted/70" />
          </div>
        </SkeletonContainer>
      ))}
    </div>
  )
}
