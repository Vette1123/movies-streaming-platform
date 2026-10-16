// What the detail hero's play button says, and what it is called.
//
// It was a bare round play glyph: the episode it would start lived only in its
// aria-label, so the one fact a series page most needs to show ("this resumes
// S2 · E3, not the pilot") was invisible. The visible text and the accessible
// name are built together so they always start with the same verb — speech
// control users say what they see.

export interface PlayCueInput {
  title: string
  /** Series only: the episode a press will start. */
  target?: { season: number; episode: number } | null
  /** The target came from stored progress, not from the URL. */
  isResume?: boolean
  /**
   * That stored episode was finished and the target moved on to the next one,
   * which starts from the top: "Watch", not "Resume".
   */
  isNext?: boolean
}

export interface PlayCue {
  text: string
  label: string
}

export function playCue({
  title,
  target,
  isResume,
  isNext,
}: PlayCueInput): PlayCue {
  if (!target) return { text: 'Watch Now', label: `Watch ${title}` }
  const verb = isResume && !isNext ? 'Resume' : 'Watch'
  return {
    text: `${verb} S${target.season} · E${target.episode}`,
    label: `${verb} ${title}, season ${target.season} episode ${target.episode}`,
  }
}
