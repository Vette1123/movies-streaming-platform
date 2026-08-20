import { Skeleton } from '@/components/ui/skeleton'

/**
 * The console, before the session has answered.
 *
 * Not a spinner: the panel below is entirely client-rendered (the session is
 * only known after hydration), so a one-line "checking…" made the page a
 * fraction of its settled height and the footer was shoved down the moment the
 * real thing arrived — a 0.48 layout shift on every refresh.
 *
 * Holding *a* shape is not enough either. This started with eight tiles while
 * the console had twelve sections, and a plan card reserved at the height it
 * takes on a laptop; on a phone the page then grew ~685px when the real thing
 * landed and the footer jumped that far down. It measured as ZERO CLS — the
 * footer was below the fold, and CLS only counts what is on screen — which is
 * exactly why it survived a sweep. So: the tile count comes from the caller's
 * own section list and cannot drift, and the reserves below are heights
 * measured on a real account rather than guessed.
 */
export function AccountSkeleton({ sections = 12 }: { sections?: number }) {
  return (
    <div aria-hidden className="space-y-10">
      {/* Identity: avatar, name, the line under it. */}
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        {/* One picker button on a phone, the full rail on a laptop. The rail
            row count is the sections plus the Overview row above them. */}
        <Skeleton className="h-[3.75rem] w-full rounded-xl lg:hidden" />
        <div className="hidden lg:flex lg:flex-col lg:gap-1">
          {Array.from({ length: sections + 1 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-full rounded-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        <div className="min-w-0 space-y-8">
          {/* The plan card. Tall on a phone, where its paragraph wraps to five
              or six lines; a third of that on a laptop. */}
          <Skeleton className="h-[22rem] w-full rounded-lg sm:h-64 lg:h-44" />

          {/* Three counts. */}
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[5.25rem] w-full rounded-lg"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>

          {/* Where to go next — one tile per section. */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: sections }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-[6.5rem] w-full rounded-xl"
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
