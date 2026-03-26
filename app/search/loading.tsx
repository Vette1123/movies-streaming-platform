import React from 'react'

export default function SearchLoading() {
  return (
    <main className="container max-w-(--breakpoint-2xl) py-24 lg:py-32">
      <div className="mb-8 flex flex-col gap-4">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-11 w-full max-w-xl animate-pulse rounded-full bg-muted/30" />
      </div>
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-[150px] sm:w-[170px]">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted/40" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted/30" />
            <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </main>
  )
}
