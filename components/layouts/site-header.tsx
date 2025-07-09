'use client'

import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { useNavbarScrollOverlay } from '@/hooks/use-scroll-overlay'
import { buttonVariants } from '@/components/ui/button'
import { CommandMenu } from '@/components/command-menu'
import { Icons } from '@/components/icons'
import { MainNav } from '@/components/layouts/main-nav'
import { MobileNav } from '@/components/layouts/mobile-nav'

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
          <nav className="flex items-center space-x-1">
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
                <span className="sr-only">Twitter</span>
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
