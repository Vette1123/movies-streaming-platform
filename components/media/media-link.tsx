'use client'

import React from 'react'
import Link from 'next/link'

import { usePrefetchIntent } from '@/hooks/use-prefetch-intent'

interface MediaLinkProps {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
  'aria-label'?: string
}

/**
 * The one link used for anything that points at a media detail route.
 *
 * Detail routes are the ones that must NOT viewport-prefetch: a homepage mounts
 * 100+ posters, and one RSC request each trips the Cloudflare rate limit on
 * detail paths (100 req/10s) on our own page load. But `prefetch={false}` alone
 * means the route is never warmed at all in Next 16 — see
 * hooks/use-prefetch-intent.ts — so the pairing of that prop with the intent
 * handlers has to travel together or a caller gets one without the other. It had
 * already been hand-rolled three different ways across Card, WatchedItemCard,
 * StaticRail and the hero, each with its own comment and one (the hero's) with
 * no touch handler at all.
 *
 * Being a client component is also what lets StaticRail — which is deliberately
 * server-rendered, with no client machinery of its own — warm its posters
 * without hydrating the whole rail.
 */
export function MediaLink({
  href,
  className,
  children,
  onClick,
  'aria-label': ariaLabel,
}: MediaLinkProps) {
  const prefetchIntent = usePrefetchIntent(href)

  return (
    <Link
      href={href}
      prefetch={false}
      {...prefetchIntent}
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  )
}
