'use client'

import React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

interface CountBadgeProps {
  count?: number
  // `solid` = the filled pill on the Filters trigger button; `soft` = the tinted
  // per-section count in the sidebar header. Both were hand-copied before.
  tone?: 'solid' | 'soft'
  className?: string
}

export const CountBadge = ({
  count,
  tone = 'solid',
  className,
}: CountBadgeProps) => {
  if (!count || count <= 0) return null
  return (
    <span
      className={cn(
        'flex h-5 min-w-5 items-center justify-center rounded-full font-semibold tabular-nums',
        tone === 'solid'
          ? 'bg-primary text-primary-foreground ml-1 px-1 text-xs'
          : 'bg-primary/15 text-primary px-1.5 text-[11px]',
        className
      )}
    >
      {count}
    </span>
  )
}

// The outline "Filters" trigger shared by FilterDialog and FilterSheet. Kept as a
// forwardRef Button so it drops straight into a Radix `asChild` Trigger (which
// clones it and composes its own onClick).
export const FilterTriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { activeFilterCount: number }
>(function FilterTriggerButton({ activeFilterCount, ...props }, ref) {
  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className="gap-2"
      type="button"
      {...props}
    >
      <Icons.filter className="h-4 w-4" />
      Filters
      <CountBadge count={activeFilterCount} />
    </Button>
  )
})
