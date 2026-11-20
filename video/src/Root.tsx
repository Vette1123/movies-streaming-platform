import React from 'react'
import { Composition } from 'remotion'

import { Film } from './Film'
import { DURATION, FPS } from './timing'

export const Root: React.FC = () => (
  <>
    <Composition
      id="Film"
      component={Film}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Reel"
      component={Film}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
)
