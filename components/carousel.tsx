'use client'

import React from 'react'
import SwipeableViews from 'react-swipeable-views'

export const Carousel = ({ children }: { children: React.ReactNode }) => {
  return (
    <SwipeableViews
      enableMouseEvents
      className="cursor-grabbing"
      loop
      animateTransitions={true}
      threshold={1}
    >
      {children}
    </SwipeableViews>
  )
}
