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

/**
 * The wordmark, rendered by SiteHeader rather than by MainNav.
 *
 * It used to live inside MainNav, which meant it inherited MainNav's
 * breakpoint — so every width below the desktop nav's showed a header with a
 * hamburger, a search box and no brand on it at all. The logo is not part of
 * the nav; it belongs at every size.
 */
export function BrandLogo() {
  return (
    <Link
      href="/"
      prefetch={false}
      aria-label={`${siteConfig.name} home`}
      className="flex shrink-0 items-baseline space-x-2"
    >
      <Icons.reelLogo className="size-7 shrink-0 self-center" />
      <span className="text-secondary-foreground hidden text-2xl font-bold whitespace-nowrap sm:inline-block 2xl:text-3xl">
        {siteConfig.name}
      </span>
    </Link>
  )
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname()
  return (
    // xl, not lg. Six labels plus the logo plus the search box do not fit the
    // 960px of content lg leaves, so between 1024 and 1279 this used to render
    // anyway and buckle — "TV Shows" and "Watch History" broke onto a second
    // line inside a 4rem header and ran into the search box. Below xl the
    // hamburger drawer carries the same routes.
    <div className="hidden shrink-0 items-center xl:flex">
      {items?.length ? (
        <nav className="flex items-center gap-4 2xl:gap-6">
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
                    // whitespace-nowrap is the actual guard: a flex row will
                    // happily break a two-word label rather than overflow, and
                    // a wrapped label is taller than the header.
                    'text-secondary-foreground flex shrink-0 items-center text-sm font-medium whitespace-nowrap 2xl:text-base',
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
