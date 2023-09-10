import React from 'react'

import { SkeletonContainer } from '../ui/skeleton'

export const SliderHorizontalListLoader = () => {
  return (
    <div className="container h-full pb-10 pt-12 lg:pb-20">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonContainer key={i}>
            <div className="space-y-3">
              <div className="h-36 rounded-lg bg-gray-500" />
              <div className="h-3 w-11/12 rounded-lg bg-gray-500" />
              <div className="h-3 w-8/12 rounded-lg bg-gray-500" />
            </div>
          </SkeletonContainer>
        ))}
      </div>
    </div>
  )
}
