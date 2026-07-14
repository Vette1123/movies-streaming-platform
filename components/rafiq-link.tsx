'use client'

import React from 'react'

import { openRafiqOnPlayStore, RAFIQ_PLAY_STORE_URL } from '@/lib/rafiq'
import { cn } from '@/lib/utils'

// Footer link to Rafiq, our companion app. Renders a real Play Store anchor
// (right-click / no-JS friendly) but intercepts the click to prefer the native
// Play Store app, falling back to the web listing — matching Rafiq's own logic.
export function RafiqLink({
  className,
  children = 'Rafiq',
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={RAFIQ_PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        openRafiqOnPlayStore()
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
