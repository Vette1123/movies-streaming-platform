'use client'

import React from 'react'
import SwipeableViews from 'react-swipeable-views'

export const Carousel = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="overflow-hidden motion-reduce:transition-none">
      <SwipeableViews
        enableMouseEvents
        className="cursor-grabbing"
        loop
        animateTransitions={true}
      >
        {children}
      </SwipeableViews>
    </div>
  )
}
