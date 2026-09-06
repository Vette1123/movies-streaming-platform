'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The box the player lives in: controls in the band above, picture below.
 *
 * The controls used to be an `absolute inset-x-0 top-20` overlay on the hero's
 * CONTAINER, and the frame a `size-full py-20` sibling of it. Both numbers were
 * 20, which is the whole bug: `top-20` put the bar exactly where `py-20` put
 * the first pixel of video, and the container is wider than the frame, so the
 * measured result on a 1440px hero was a 1440-wide bar starting at the same y
 * as a 1380-wide picture. Chips sat on the film and hung 30px past it on both
 * sides. A comment above the overlay claimed the band above the frame was empty
 * on every viewport; it was never empty, because nothing was reserving it.
 *
 * A column fixes it by construction rather than by arithmetic: the bar is a
 * flex row that reserves its own height, the frame takes what is left, and the
 * two share one width. There is no offset left to get wrong, and the bar cannot
 * overhang a frame it is stacked on top of.
 *
 * Both surfaces mount through here — the house player and the third-party
 * embed — so the inset, the spinner and the stacking context are written once.
 * They were duplicated, and had already drifted: only one of them centred the
 * spinner over the frame rather than over the whole hero.
 */
export function PlayerStage({
  controls,
  loaded,
  bannerInset,
  showSpinner = true,
  children,
}: {
  /** The control bar. Rendered in the band above the picture, flush to it. */
  controls?: React.ReactNode
  /** Whether the frame has painted. Drives the spinner. */
  loaded: boolean
  /**
   * A Watch Together room is on screen. That banner is pinned to the hero at
   * `top-16` and is about 30px tall, which reaches past a 20-unit band and onto
   * the controls. Deepen the band rather than move the banner: the room is a
   * page-level notice and belongs above the player, not inside its chrome.
   */
  bannerInset?: boolean
  /**
   * Whether the spinner may show at all. The embed surface keeps its frame
   * mounted before playback starts, and a spinner over an empty stage would
   * claim something is loading when nothing has been asked for yet.
   */
  showSpinner?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex size-full flex-col pb-20',
        bannerInset ? 'pt-28' : 'pt-20'
      )}
    >
      {controls ? (
        // justify-end so the bar sits flush against the top of the picture and
        // anything that appears above it (the stall notice) grows upward into
        // the band instead of pushing the video down.
        <div className="pointer-events-none z-50 flex shrink-0 flex-col justify-end pb-2 empty:hidden">
          {controls}
        </div>
      ) : null}
      {/* min-h-0 so the frame can actually shrink inside the column; without it
          a flex item refuses to go below its content's intrinsic height and the
          picture overflows the hero instead of fitting it. */}
      <div className="relative min-h-0 flex-1">
        {children}
        {showSpinner && !loaded ? (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <Loader2 className="size-12 animate-spin text-white/80" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
