import React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { autoPlay } from 'react-swipeable-views-utils'

const AutoPlaySwipeableViews = autoPlay(SwipeableViews)

interface CarouselProps {
  children: React.ReactNode
}

export function Carousel({ children }: CarouselProps) {
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
  ) as React.ReactNode
}
