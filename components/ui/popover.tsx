'use client'

import * as React from 'react'
import Link from 'next/link'
import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverClose = PopoverPrimitive.Close

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-[--radix-popover-content-transform-origin] rounded-md border p-4 shadow-md outline-none',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

// Every menu popover on the site renders the same row: icon, title, optional
// second line. One template so the account menu, the apps list and the links
// list can't drift apart on icon size, gap or hover treatment — the drawer's
// DrawerAction is the same idea for the mobile side.
const POPOVER_ROW =
  'hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left outline-none'

function PopoverHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium">
      {children}
    </p>
  )
}

export interface PopoverRowProps {
  Icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  iconClassName?: string
  /** Present → renders a <Link>; absent → a <button>. */
  href?: string
  /** Opens in a new tab. Off by default: our own routes stay in this one. */
  external?: boolean
  onClick?: () => void
}

/**
 * A row inside a menu popover.
 *
 * Wrapped in `PopoverPrimitive.Close` rather than each caller closing by hand:
 * Radix keeps a popover open when something inside it is clicked, which is
 * correct for a form and wrong for a menu — picking a destination left the panel
 * hanging over the page it had just navigated to, and on a phone that panel
 * covers most of the screen. Closing here means no row on any surface can be
 * added without it.
 */
function PopoverRow({
  Icon,
  title,
  subtitle,
  iconClassName,
  href,
  external,
  onClick,
}: PopoverRowProps) {
  const content = (
    <>
      <Icon className={cn('size-5 shrink-0', iconClassName)} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        {subtitle && (
          <span className="text-muted-foreground text-xs">{subtitle}</span>
        )}
      </span>
    </>
  )

  if (href) {
    return (
      <PopoverClose asChild>
        <Link
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          onClick={onClick}
          className={POPOVER_ROW}
        >
          {content}
        </Link>
      </PopoverClose>
    )
  }

  return (
    <PopoverClose asChild>
      <button type="button" onClick={onClick} className={POPOVER_ROW}>
        {content}
      </button>
    </PopoverClose>
  )
}

export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverHeading,
  PopoverRow,
  PopoverTrigger,
}
