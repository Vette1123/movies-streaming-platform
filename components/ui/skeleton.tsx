import clsx from 'clsx'

import { cn } from '@/lib/utils'

/**
 * The sheen every placeholder in the app shares: a highlight that sweeps across
 * the block rather than a flat pulse. Written once here because a placeholder
 * that animates differently from the one next to it reads as two bugs, not two
 * components — see components/loaders/* and every panel that loads.
 */
const SHEEN =
  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent motion-reduce:animate-none motion-reduce:before:animate-none'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted animate-pulse rounded-md', SHEEN, className)}
      {...props}
    />
  )
}

function SkeletonContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton className={clsx('bg-background rounded-2xl p-4', className)}>
      {props.children}
    </Skeleton>
  )
}

/**
 * A stack of card-shaped placeholders. The shape a panel is waiting for is a
 * list of rows far more often than it is anything else, so this is the one
 * everything from lists to alerts reaches for.
 */
function SkeletonRows({
  rows = 3,
  className,
  rowClassName,
}: {
  rows?: number
  className?: string
  rowClassName?: string
}) {
  return (
    <div aria-hidden className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-20 w-full rounded-xl', rowClassName)}
          // Each row starts its sweep a beat after the one above it, so the
          // stack reads as one object loading rather than N flashing at once.
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * Rows that are a poster, a title, a line of meta and a progress bar — the
 * shape "up next", "coming up" and every other library row settle into. Mirrors
 * the real row closely enough that nothing moves when the data lands.
 */
function SkeletonMediaRows({
  rows = 4,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <ul
      aria-hidden
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="border-border/60 flex items-center gap-4 rounded-lg border p-3"
        >
          <Skeleton
            className="aspect-2/3 w-14 shrink-0 rounded sm:w-16"
            style={{ animationDelay: `${i * 90}ms` }}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton
              className="h-3.5 w-3/5"
              style={{ animationDelay: `${i * 90}ms` }}
            />
            <Skeleton
              className="h-3 w-2/5"
              style={{ animationDelay: `${i * 90}ms` }}
            />
            <Skeleton
              className="h-1 w-full rounded-full"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export { Skeleton, SkeletonContainer, SkeletonRows, SkeletonMediaRows }
