import React from 'react'

import { SkeletonContainer } from '@/components/ui/skeleton'

export const FullScreenLoader = () => {
  return (
    <SkeletonContainer className="py-20">
      <div className="space-y-3">
        <div className="min-h-[80dvh] rounded-lg bg-muted/80" />
        <div className="h-3 w-11/12 rounded-lg bg-muted" />
        <div className="h-3 w-8/12 rounded-lg bg-muted/70" />
      </div>
    </SkeletonContainer>
  )
}
