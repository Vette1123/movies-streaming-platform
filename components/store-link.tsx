'use client'

import React from 'react'

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
}: {
  app: CompanionApp
  className?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={storeHref(app)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault()
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
