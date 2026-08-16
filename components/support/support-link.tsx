'use client'

import Link from 'next/link'

import { trackSupportCtaClicked } from '@/lib/analytics'

/**
 * A link to `/support` that says where it was clicked.
 *
 * The routes to the plans are spread across the site on purpose, and the only
 * way to know which of them is worth its space — or which is only in the way —
 * is to label them. One client component for the surfaces that are otherwise
 * server-rendered, so the footer does not have to become a client tree to
 * record a click.
 */
export function SupportLink({
  surface,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, 'href'> & { surface: string }) {
  return (
    <Link
      {...rest}
      href="/support"
      className={className}
      onClick={() => trackSupportCtaClicked({ surface })}
    >
      {children}
    </Link>
  )
}
