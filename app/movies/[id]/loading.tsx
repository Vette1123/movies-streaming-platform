import React from 'react'

import { SkeletonContainer } from '@/components/ui/skeleton'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'

export default function MovieDetailsLoading() {
  return (
    <>
      {/* Hero skeleton */}
      <SkeletonContainer className="min-h-[80dvh] rounded-none p-0">
        <div className="absolute bottom-0 left-0 right-0 container max-w-(--breakpoint-2xl) space-y-4 pb-16">
          <div className="h-5 w-20 rounded-full bg-muted/60" />
          <div className="h-10 w-80 rounded-lg bg-muted/60" />
          <div className="h-4 w-40 rounded-lg bg-muted/40" />
          <div className="h-4 w-72 rounded-lg bg-muted/40" />
          <div className="flex gap-3 pt-2">
            <div className="h-10 w-32 rounded-full bg-muted/60" />
            <div className="h-10 w-10 rounded-full bg-muted/40" />
            <div className="h-10 w-10 rounded-full bg-muted/40" />
          </div>
        </div>
      </SkeletonContainer>

      {/* Content skeleton */}
      <div className="container max-w-(--breakpoint-2xl) py-10">
        <div className="flex gap-10">
          <div className="hidden h-[540px] w-[360px] shrink-0 rounded-xl bg-muted/30 lg:block" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-64 rounded bg-muted/50" />
            <div className="h-4 w-full rounded bg-muted/30" />
            <div className="h-4 w-5/6 rounded bg-muted/30" />
            <div className="h-4 w-4/6 rounded bg-muted/30" />
            <div className="mt-6 grid grid-cols-4 gap-4 pt-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-20 rounded-lg bg-muted/30" />
                  <div className="h-3 w-full rounded bg-muted/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12">
          <SliderHorizontalListLoader />
        </div>
      </div>
    </>
  )
}
