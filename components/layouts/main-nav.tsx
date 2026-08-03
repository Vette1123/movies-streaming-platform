import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavItem } from '@/types/navbar'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname()
  return (
    <div className="hidden gap-6 md:gap-10 lg:flex">
      <Link href="/" prefetch={false} className="flex items-baseline space-x-2">
        <Icons.reelLogo className="h-7 w-7" />
        <span className="text-secondary-foreground inline-block text-3xl font-bold">
          {siteConfig.name}
        </span>
      </Link>
      {items?.length ? (
        <nav className="flex gap-6">
          {items?.map(
            (item, index) =>
              item.href && (
                <Link
                  key={index}
                  href={item.href}
                  scroll={item.scroll}
                  // Header is always in-viewport, so every nav route auto-prefetches
                  // on each page load — one Worker RSC hit per route. Fetch on click.
                  prefetch={false}
                  className={cn(
                    'text-secondary-foreground flex items-center text-base font-medium',
                    pathname === item.href && 'underline underline-offset-4',
                    buttonVariants({
                      size: 'text',
                      variant: 'ghost',
                    }),
                    item.disabled && 'cursor-not-allowed opacity-80'
                  )}
                >
                  {/* Plain span. This used to be a `motion.span` with a
                      `layoutId`, which animated nothing: shared-layout only
                      transitions when an element with that id unmounts and
                      another mounts, and every nav label is mounted for the
                      whole session. It cost real money though — the nav lives
                      in the root layout, so that one no-op dragged framer-motion
                      into EVERY route's bundle, and gave each label a layout
                      projection node measured on every render. */}
                  <span>{item.title}</span>
                </Link>
              )
          )}
        </nav>
      ) : null}
    </div>
  )
}
