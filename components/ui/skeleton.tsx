import clsx from 'clsx'

import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

function SkeletonContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={clsx(
        'rounded-2xl bg-background p-4',
        'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
    >
      {props.children}
    </Skeleton>
  )
}

export { Skeleton, SkeletonContainer }
