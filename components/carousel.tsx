import React from 'react'
import SwipeableViews from 'react-swipeable-views'
import { autoPlay } from 'react-swipeable-views-utils'

const AutoPlaySwipeableViews = autoPlay(SwipeableViews)

interface CarouselProps {
  children: React.ReactNode
}

export const Carousel: React.FC<CarouselProps> = ({ children }) => {
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
