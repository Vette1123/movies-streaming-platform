'use client'

import React from 'react'

import { type SeriesProgress } from '@/hooks/use-series-progress'

interface ContinueWatchingProps {
  progress: SeriesProgress
  // Resolved from the season list the navigator already fetched, so it arrives a
  // beat after the season/episode numbers. The caption reads fine without it.
  episodeName?: string
}

// "Up next" only when the stored episode is finished and we advanced past it;
// otherwise the user is mid-episode and the honest verb is "Resume".
const resumeVerb = (isNext: boolean) => (isNext ? 'Up next' : 'Resume')

const progressLabel = (progress: SeriesProgress) => {
  if (progress.isFinished)
    return `All ${progress.totalEpisodes} episodes watched`
  return `${progress.completedCount} of ${progress.totalEpisodes} episodes watched`
}

// Caption under the hero play button: what pressing play will actually start,
// plus how far through the series the user is. Renders nothing until
// localStorage has been read (hydration safety) and nothing at all for a series
// with no history, so a first-time visitor sees the untouched hero.
export const ContinueWatching = ({
  progress,
  episodeName,
}: ContinueWatchingProps) => {
  const { resume, totalEpisodes, completedCount, percent, isReady } = progress
  if (!isReady) return null
  if (!resume && !completedCount) return null

  return (
    // Its own scrim: the backdrop behind the hero is a different image on every
    // series (and can be near-white), so the caption cannot rely on the page
    // gradient for contrast the way the action buttons can.
    <div className="flex w-[min(22rem,80vw)] flex-col items-center gap-2.5 rounded-2xl bg-black/45 px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm">
      {resume && (
        <p className="text-center text-sm leading-snug text-white">
          <span className="text-white/70">{resumeVerb(resume.isNext)}</span>{' '}
          <span className="font-semibold tabular-nums">
            S{resume.season} · E{resume.episode}
          </span>
          {episodeName && (
            <span className="mt-0.5 line-clamp-1 block text-white/80">
              {episodeName}
            </span>
          )}
        </p>
      )}
      {totalEpisodes > 0 && (
        <div className="flex w-full flex-col items-center gap-1.5">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Series progress"
            className="h-1 w-full overflow-hidden rounded-full bg-white/25"
          >
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-white/70 tabular-nums">
            {progressLabel(progress)}
          </span>
        </div>
      )}
    </div>
  )
}
