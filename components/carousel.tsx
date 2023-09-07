'use client'

import React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { autoPlay } from 'react-swipeable-views-utils'

const AutoPlaySwipeableViews = autoPlay(SwipeableViews)

export const Carousel = ({ children }: { children: React.ReactNode }) => {
  return (
    <AutoPlaySwipeableViews
      enableMouseEvents
      className="cursor-grabbing"
      loop
      animateTransitions={true}
      threshold={1}
    >
      {children}
    </AutoPlaySwipeableViews>
  )
}
