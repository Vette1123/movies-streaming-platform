import Link from 'next/link'

import { cn } from '@/lib/utils'

// Every action in the mobile drawer — the account rows, the install prompt, the
// Play Store apps, the external links — renders through one row template so icon
// size, gap, height and label alignment can't drift apart again. Tone is the
// *only* thing that varies, and it maps to hierarchy: accent = the one primary
// CTA, brand = our own products, muted = everything else.
export type DrawerTone = 'accent' | 'brand' | 'muted'

const DRAWER_ROW =
  'ring-offset-background focus-visible:ring-ring inline-flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'

const DRAWER_TONE: Record<DrawerTone, string> = {
  accent:
    'bg-gradient-to-br from-cyan-300 to-cyan-500 text-[#04121a] hover:from-cyan-200 hover:to-cyan-400',
  brand:
    'border border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
  muted:
    'border-border/60 bg-muted/40 text-foreground hover:bg-muted border hover:text-foreground',
}

export interface DrawerActionProps {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  /** Right-aligned qualifier, e.g. where the link goes. */
  hint?: string
  tone?: DrawerTone
  iconClassName?: string
  ariaLabel?: string
  /** Present → renders a <Link>; absent → a <button>. */
  href?: string
  /** Opens in a new tab. Off by default: our own routes stay in this one. */
  external?: boolean
  onClick?: () => void
}

export function DrawerAction({
  Icon,
  label,
  hint,
  tone = 'muted',
  iconClassName,
  ariaLabel,
  href,
  external,
  onClick,
}: DrawerActionProps) {
  const className = cn(DRAWER_ROW, DRAWER_TONE[tone])
  const content = (
    <>
      <Icon className={cn('size-5 shrink-0', iconClassName)} />
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="shrink-0 text-xs font-normal opacity-60">{hint}</span>
      )}
    </>
  )

  if (href) {
    // A Worker route is not a page. `next/link` would try to client-navigate to
    // /api/auth/google and land on the 404 asset instead of starting the
    // sign-in, so anything that is not an app route is a plain document
    // navigation.
    if (external || !href.startsWith('/') || href.startsWith('/api/')) {
      return (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          aria-label={ariaLabel ?? label}
          onClick={onClick}
          className={className}
        >
          {content}
        </a>
      )
    }

    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? label}
        onClick={onClick}
        className={className}
      >
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

export function DrawerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-muted-foreground px-1 text-[11px] font-semibold tracking-widest uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
