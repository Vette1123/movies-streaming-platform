import React from 'react'

import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'

export default function PersonLoading() {
  return (
    <main className="container max-w-(--breakpoint-2xl) py-24 lg:py-32">
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="mx-auto h-[280px] w-[190px] shrink-0 animate-pulse rounded-xl bg-muted/40 sm:mx-0" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-muted/50" />
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted/40" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted/30" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted/30" />
          </div>
        </div>
      </div>
      <div className="mt-12 border-t border-white/10 pt-10">
        <SliderHorizontalListLoader />
        <SliderHorizontalListLoader />
      </div>
    </main>
  )
}
