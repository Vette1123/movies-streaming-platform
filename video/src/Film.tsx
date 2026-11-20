import React, { useEffect } from 'react'
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

import { loadFonts } from './fonts'
import {
  Detail,
  Discover,
  Drop,
  Hook,
  Outro,
  Promise as Promises,
  Track,
} from './scenes'
import { IN_OUT } from './theme'
import { b, CROSS, SCENES } from './timing'

const VIEWS: Record<keyof typeof SCENES, React.FC> = {
  hook: Hook,
  drop: Drop,
  discover: Discover,
  detail: Detail,
  track: Track,
  promise: Promises,
  outro: Outro,
}

/** Hard cuts on the hits (the drop, the payoff, the outro); a moving cross everywhere else. */
const HARD_IN = new Set(['drop', 'promise', 'outro'])

const Shot: React.FC<{
  name: string
  dur: number
  children: React.ReactNode
}> = ({ name, dur, children }) => {
  const frame = useCurrentFrame()
  const soft = !HARD_IN.has(name)
  const enter = soft
    ? interpolate(frame, [0, CROSS], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: IN_OUT,
      })
    : 1
  const exit = interpolate(frame, [dur - CROSS, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: IN_OUT,
  })
  const scale = 1.03 - enter * 0.03 + (1 - exit) * 0.02
  return (
    <AbsoluteFill
      style={{ opacity: Math.min(enter, exit), transform: `scale(${scale})` }}
    >
      {children}
    </AbsoluteFill>
  )
}

export const Film: React.FC = () => {
  const { durationInFrames } = useVideoConfig()
  useEffect(() => {
    loadFonts()
  }, [])
  loadFonts()
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {(Object.keys(SCENES) as Array<keyof typeof SCENES>).map((name) => {
        const [from, to] = SCENES[name]
        const last = to * 30 >= durationInFrames
        const dur = b(to - from) + (last ? 0 : CROSS)
        const View = VIEWS[name]
        return (
          <Sequence
            key={name}
            from={b(from)}
            durationInFrames={dur}
            name={name}
          >
            <Shot name={name} dur={last ? dur + CROSS : dur}>
              <View />
            </Shot>
          </Sequence>
        )
      })}
      <Audio src={staticFile('audio/beat-reely.wav')} />
    </AbsoluteFill>
  )
}
