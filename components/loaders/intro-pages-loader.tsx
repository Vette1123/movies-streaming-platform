import React from 'react'

import { SkeletonContainer } from '@/components/ui/skeleton'

export const FullScreenLoader = () => {
  return (
    <SkeletonContainer className="py-20">
      <div className="space-y-3">
        <div className="bg-muted/80 min-h-[80dvh] rounded-lg" />
        <div className="bg-muted h-3 w-11/12 rounded-lg" />
        <div className="bg-muted/70 h-3 w-8/12 rounded-lg" />
      </div>
    </SkeletonContainer>
  )
}
