'use client'

import { CloudOff, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

interface ListLoadErrorProps {
  // True when the list has nothing on screen at all (page 1 failed), false when
  // earlier pages rendered and only the next one failed.
  isEmpty: boolean
  onRetry: () => void
}

// The single retry surface for every paginated media list. Without it a failed
// /api/* call leaves the grid on skeletons forever: react-query stops retrying,
// `isLoading` goes false, and no branch renders — the "no results" branches all
// require at least one loaded page, which an errored query never has.
//
// Two shapes, one component: a full empty state when nothing loaded, and a
// compact strip under the grid when only the next page failed (keeping the
// cards the user already has).
export const ListLoadError = ({ isEmpty, onRetry }: ListLoadErrorProps) => {
  // Swallow the click event: callers hand us react-query's `refetch` /
  // `fetchNextPage` directly, and those read their first argument as an options
  // object — a MouseEvent there is not what they expect.
  const handleRetry = () => onRetry()

  if (isEmpty) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Couldn't load these titles"
        description="The request didn't come back. This is usually a passing network hiccup — try again in a moment."
        primaryAction={{
          label: 'Try again',
          onClick: handleRetry,
          icon: RotateCw,
        }}
        className="min-h-[50vh]"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t load more titles.
      </p>
      <Button variant="outline" onClick={handleRetry}>
        Try again
      </Button>
    </div>
  )
}
