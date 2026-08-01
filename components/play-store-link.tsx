'use client'

import React from 'react'

import { CompanionApp, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'

// Footer link to one of our companion apps. Renders a real Play Store anchor
// (right-click / no-JS friendly) but intercepts the click to prefer the native
// Play Store app, falling back to the web listing — matching the apps' own logic.
export function PlayStoreLink({
  app,
  className,
  children = app.name,
}: {
  app: CompanionApp
  className?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={app.playStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        openOnPlayStore(app)
      }}
      className={cn(
        'text-foreground/75 hover:text-foreground font-medium transition-colors',
        className
      )}
    >
      {children}
    </a>
  )
}
