'use client'

import React from 'react'

export interface EpisodeTarget {
  season: number
  episode: number
}

type PlayHandler = (target: EpisodeTarget) => void

interface SeriesPlaybackValue {
  // The episode the embed is actually loaded with — null until someone presses
  // play. NOT the same as ?season/?episode, which only says what the page is
  // pointed at.
  playing: EpisodeTarget | null
  requestPlay: PlayHandler
  // The hero owns the iframe; it registers the real player here on mount.
  registerPlayer: (play: PlayHandler) => () => void
  reportPlaying: (target: EpisodeTarget | null) => void
}

const NOOP_VALUE: SeriesPlaybackValue = {
  playing: null,
  requestPlay: () => {},
  registerPlayer: () => () => {},
  reportPlaying: () => {},
}

const SeriesPlaybackContext =
  React.createContext<SeriesPlaybackValue>(NOOP_VALUE)

export const useSeriesPlayback = () => React.useContext(SeriesPlaybackContext)

// Bridges the two halves of a series page: the episode list (inside the season
// navigator) asks for playback, the hero — a sibling subtree — owns the embed.
// They used to talk through ?season/?episode alone, which conflated "the
// visitor arrived at this URL" with "the visitor pressed play": every
// continue-watching / shared link auto-started the stream on load. Play is now
// an explicit call, and the URL is left to do what a URL does — say which
// episode the page is pointed at.
export const SeriesPlaybackProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [playing, setPlaying] = React.useState<EpisodeTarget | null>(null)
  // A ref, not state: registration must not re-render the page, and requestPlay
  // has to keep a stable identity for the list's click handler.
  const playerRef = React.useRef<PlayHandler | null>(null)

  const registerPlayer = React.useCallback((play: PlayHandler) => {
    playerRef.current = play
    return () => {
      if (playerRef.current === play) playerRef.current = null
    }
  }, [])

  const requestPlay = React.useCallback((target: EpisodeTarget) => {
    playerRef.current?.(target)
  }, [])

  const reportPlaying = React.useCallback((target: EpisodeTarget | null) => {
    setPlaying((prev) => {
      if (prev?.season === target?.season && prev?.episode === target?.episode)
        return prev
      return target
    })
  }, [])

  const value = React.useMemo(
    () => ({ playing, requestPlay, registerPlayer, reportPlaying }),
    [playing, requestPlay, registerPlayer, reportPlaying]
  )

  return (
    <SeriesPlaybackContext.Provider value={value}>
      {children}
    </SeriesPlaybackContext.Provider>
  )
}
