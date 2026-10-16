'use client'

import React from 'react'

import { type SeriesProgress } from '@/hooks/use-series-progress'

interface ContinueWatchingProps {
  progress: SeriesProgress
  // Resolved from the season list the navigator already fetched, so it arrives a
  // beat after the season/episode numbers. The caption reads fine without it.
  // The caller leaves it out when the play button is aimed somewhere else (a
  // ?season/?episode link), so the name never captions the wrong episode.
  episodeName?: string
}

const progressLabel = (progress: SeriesProgress) => {
  if (progress.isFinished)
    return `All ${progress.totalEpisodes} episodes watched`
  return `${progress.completedCount} of ${progress.totalEpisodes} episodes watched`
}

// Caption above the hero play button: the name of the episode it starts, and
// how far through the series the user is. The season and episode themselves
// are on the button ("Resume S2 · E3"), so they are not repeated here. Renders
// nothing until localStorage has been read (hydration safety) and nothing at
// all for a series with no history, so a first-time visitor sees the untouched
// hero.
export const ContinueWatching = ({
  progress,
  episodeName,
}: ContinueWatchingProps) => {
  const { resume, totalEpisodes, completedCount, percent, isReady } = progress
  if (!isReady) return null
  if (!resume && !completedCount) return null

  return (
    // No box of its own any more: it sits in the hero's copy column, over the
    // bottom-up scrim that already carries the title and synopsis, and takes
    // the same text shadow they do.
    <div className="flex w-full max-w-md flex-col gap-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">
      {resume && episodeName && (
        <p className="line-clamp-1 text-sm font-medium text-white/90">
          “{episodeName}”
        </p>
      )}
      {totalEpisodes > 0 && (
        <div className="flex w-full items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Series progress"
            className="h-1 min-w-16 flex-1 overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-white/80 tabular-nums">
            {progressLabel(progress)}
          </span>
        </div>
      )}
    </div>
  )
}
