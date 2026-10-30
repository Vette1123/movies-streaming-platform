'use client'

import React from 'react'

import { trackFeatureUsed } from '@/lib/analytics'
import { CompanionApp, openStoreListing, storeHref } from '@/lib/apps'
import { cn } from '@/lib/utils'

// Footer link to one of our companion apps. Renders a real anchor (right-click
// / no-JS friendly) but intercepts the click to send the reader to the store
// they can actually install from — the Play Store app on Android, the App Store
// on an iPhone, and the app's own chooser page from a desktop.
//
// This was `PlayStoreLink` and its href was always the Play listing, which is
// a dead end on an iPhone for the two apps that ship on both stores.
export function StoreLink({
  app,
  className,
  children = app.name,
  onOpen,
}: {
  app: CompanionApp
  className?: string
  children?: React.ReactNode
  /** Extra measurement for a surface that wants its own click count. */
  onOpen?: () => void
}) {
  return (
    <a
      href={storeHref(app)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
        trackFeatureUsed({
          feature: 'store_link',
          action: 'opened',
          app: app.slug,
        })
        onOpen?.()
        openStoreListing(app)
      }}
      className={cn(
        'font-medium text-foreground/75 transition-colors hover:text-foreground',
        className
      )}
    >
      {children}
    </a>
  )
}
