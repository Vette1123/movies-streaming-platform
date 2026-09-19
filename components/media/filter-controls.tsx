'use client'

import React, { useCallback } from 'react'

import { MediaFilter } from '@/types/filter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

// FilterDialog (desktop) and FilterSheet (mobile) render the same filter UI in
// two different Radix primitives. They share this prop contract, the open/
// trigger callbacks, and the header title — only the Dialog vs Sheet wrapper and
// its sizing differ.
export interface FilterOverlayProps {
  mediaType: 'movie' | 'tv'
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  filter: MediaFilter
  updateFilter: (updates: Partial<MediaFilter>) => void
  cycleGenre: (genreId: number) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  activeFilterCount: number
}

/**
 * Both filter overlays used to pass `onPointerDownOutside` and
 * `onInteractOutside` handlers that called `preventDefault()` unconditionally,
 * which made the dimmed backdrop inert: tapping it did nothing at all. That is
 * how every other overlay on this site closes — the account panel, the
 * disclaimer, the trailer dialog, the mobile nav — and PostHog logged the dead
 * clicks on `div.backdrop-blur-xs.bg-background/80` to prove people were trying
 * it here too.
 *
 * Neither handler carried a comment, and the thing worth checking before
 * deleting them was the four `Slider`s in the sidebar: releasing a range drag
 * past the edge of the panel is the one gesture that could plausibly reach
 * Radix as an interaction "outside" and close the panel mid-drag. It does not —
 * `onPointerDownOutside` fires on pointer DOWN, and a slider drag's pointerdown
 * is inside the content — and that was verified in a browser, dragging each
 * slider past the panel edge and releasing, before the handlers came out.
 *
 * Nothing is lost by closing either way: every filter applies live and is
 * stored in the URL by nuqs, so there is no unsaved work to protect.
 */
export function useFilterOverlay(onOpenChange: (open: boolean) => void) {
  // Prevent event bubbling that can cause mobile refresh issues.
  const handleOpenChange = useCallback(
    (open: boolean) => onOpenChange(open),
    [onOpenChange]
  )
  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(true)
    },
    [onOpenChange]
  )
  return { handleOpenChange, handleTriggerClick }
}

export function filterOverlayTitle(mediaType: 'movie' | 'tv') {
  return `Filter ${mediaType === 'movie' ? 'Movies' : 'TV Series'}`
}

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
          ? 'ml-1 bg-primary-fill px-1 text-xs text-primary-foreground'
          : 'bg-primary/15 px-1.5 text-[11px] text-primary',
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
      <Icons.filter className="size-4" />
      Filters
      <CountBadge count={activeFilterCount} />
    </Button>
  )
})
