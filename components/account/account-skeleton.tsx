import { Skeleton } from '@/components/ui/skeleton'

/**
 * The console, before the session has answered.
 *
 * Not a spinner: the panel below is entirely client-rendered (the session is
 * only known after hydration), so a one-line "checking…" made the page a
 * fraction of its settled height and the footer was shoved down the moment the
 * real thing arrived — a 0.48 layout shift on every refresh. This holds the
 * settled shape instead, and `min-h-svh` on the page keeps the footer out of
 * the viewport while the last of it lands.
 */
export function AccountSkeleton() {
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
        {/* One picker button on a phone, the twelve-row rail on a laptop. */}
        <Skeleton className="h-[3.75rem] w-full rounded-xl lg:hidden" />
        <div className="hidden lg:flex lg:flex-col lg:gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-full rounded-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        <div className="min-w-0 space-y-8">
          {/* The plan card. */}
          <Skeleton className="h-44 w-full rounded-lg" />

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

          {/* Where to go next. */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
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
