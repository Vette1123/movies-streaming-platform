import { afterNextPaint } from '@/lib/after-paint'
import type { EpisodeTarget } from '@/components/series/playback-context'

export interface EpisodeStartSteps {
  play: (target: EpisodeTarget) => void
  navigate: (target: EpisodeTarget) => void
  scroll: () => void
}

/**
 * What an episode card's tap asked for, after the tap has painted.
 *
 * The card used to swap the player in inside its click handler, so the frame
 * INP measures carried the whole swap: the bug Watch Now lost on 11 Nov
 * (lib/after-paint.ts), which the cards kept. Play goes first: the URL may
 * already name this episode (continue-watching), and then the push alone would
 * start nothing.
 */
export function startEpisode(target: EpisodeTarget, steps: EpisodeStartSteps) {
  return afterNextPaint(() => {
    steps.play(target)
    steps.navigate(target)
    steps.scroll()
  })
}
