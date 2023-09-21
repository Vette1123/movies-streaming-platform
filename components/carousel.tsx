'use client'

import React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { autoPlay } from 'react-swipeable-views-utils'

const AutoPlaySwipeableViews = autoPlay(SwipeableViews) as React.ComponentType<{
  children: React.ReactNode
  enableMouseEvents: boolean
  className: string
  loop: boolean
  animateTransitions: boolean
  threshold: number
  autoPlay: boolean
}>

export function Carousel({ children }: { children: React.ReactNode }) {
  return (
    <AutoPlaySwipeableViews
      enableMouseEvents
      className="cursor-grabbing"
      loop
      animateTransitions={true}
      threshold={1}
      autoPlay={true}
    >
      {children}
    </AutoPlaySwipeableViews>
  )
}
