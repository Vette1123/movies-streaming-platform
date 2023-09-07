'use client'

import React from 'react'
import SwipeableViews from 'react-swipeable-views'

export const Testing = ({ children }: { children: React.ReactNode }) => {
  return (
    <SwipeableViews enableMouseEvents autoPlay={true}>
      {children}
    </SwipeableViews>
  )
}
