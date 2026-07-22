'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { openRafiqOnPlayStore } from '@/lib/rafiq'
import { cn } from '@/lib/utils'
import { useNavbarScrollOverlay } from '@/hooks/use-scroll-overlay'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { MainNav } from '@/components/layouts/main-nav'
import { MobileNav } from '@/components/layouts/mobile-nav'

// The command palette (cmdk + avatar + debounce + the search server-action, ~645
// lines) sits in the root layout, so it used to ship in the first-load JS of
// every page even though it's closed until the user hits ⌘K or the search box.
// Load it on the client only, as its own chunk. The loading placeholder matches
// the trigger button's footprint so there's no layout shift while it resolves.
const CommandMenu = dynamic(
  () => import('@/components/command-menu').then((m) => m.CommandMenu),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="bg-muted/40 h-9 w-full animate-pulse rounded-md border md:w-44 lg:w-64"
      />
    ),
  }
)

export function SiteHeader() {
  const { isShowNavBackground } = useNavbarScrollOverlay()
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 w-full transition duration-200',
        {
          'bg-background/80': isShowNavBackground,
        }
      )}
    >
      <div className="container flex h-16 max-w-(--breakpoint-2xl) items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={siteConfig.mainNav} />
        <MobileNav items={siteConfig.mainNav} />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <CommandMenu />
          </div>
          <nav className="hidden items-center space-x-1 md:flex">
            <button
              type="button"
              onClick={openRafiqOnPlayStore}
              aria-label="Rafiq — our app on Google Play"
              className={buttonVariants({
                size: 'icon',
                variant: 'ghost',
              })}
            >
              <Icons.googlePlay className="size-5" />
              <span className="sr-only">Rafiq on Google Play</span>
            </button>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={buttonVariants({
                  size: 'icon',
                  variant: 'ghost',
                })}
              >
                <Icons.gitHub className="size-5" />
                <span className="sr-only">GitHub</span>
              </div>
            </Link>
            <Link
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={buttonVariants({
                  size: 'icon',
                  variant: 'ghost',
                })}
              >
                <Icons.twitter className="size-5 fill-current" />
                <span className="sr-only">X (Twitter)</span>
              </div>
            </Link>
            <Link
              href={siteConfig.author.website}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={buttonVariants({
                  size: 'icon',
                  variant: 'ghost',
                })}
              >
                <Icons.portfolio className="size-5" />
                <span className="sr-only">Portfolio</span>
              </div>
            </Link>
            <Link
              href={siteConfig.links.buyMeACoffee}
              target="_blank"
              rel="noreferrer"
            >
              <div
                className={buttonVariants({
                  size: 'icon',
                  variant: 'ghost',
                })}
              >
                <Icons.buyMeACoffee className="size-5" />
                <span className="sr-only">Buy me a coffee</span>
              </div>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
