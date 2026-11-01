'use client'

import React from 'react'

import { trackFeatureUsed } from '@/lib/analytics'
import { CompanionApp, onStoreLinkClick, storeHref } from '@/lib/apps'
import { cn } from '@/lib/utils'

// Footer link to one of our companion apps. A real anchor to the chooser page,
// which is all a desktop needs. A phone's click is intercepted to send the
// reader to their store: the Play Store app on Android, the App Store on iPhone.
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
        onStoreLinkClick(e, app)
        trackFeatureUsed({
          feature: 'store_link',
          action: 'opened',
          app: app.slug,
        })
        onOpen?.()
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
