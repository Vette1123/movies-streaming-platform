import React from 'react'

export default function WatchlistLoading() {
  return (
    <section className="container h-full py-20 lg:py-36">
      <div className="mb-8 h-9 w-40 animate-pulse rounded-lg bg-muted/50" />
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="w-[150px] sm:w-[170px]">
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted/40" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted/30" />
            <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-muted/20" />
          </div>
        ))}
      </div>
    </section>
  )
}
