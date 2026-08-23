'use client'

import dynamic from 'next/dynamic'
import { Heart } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { COMPANION_APPS, EXTERNAL_LINKS, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { useNavbarScrollOverlay } from '@/hooks/use-scroll-overlay'
import { buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeading,
  PopoverRow,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AccountControl } from '@/components/account/account-control'
import { Icons } from '@/components/icons'
import { BrandLogo, MainNav } from '@/components/layouts/main-nav'
import { MobileNav } from '@/components/layouts/mobile-nav'
import { SupportLink } from '@/components/support/support-link'

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
        // Widths must track the real trigger in command-menu.tsx, or the swap
        // shifts the header.
        className="bg-muted/40 h-9 w-full animate-pulse rounded-md border md:w-44 xl:w-52 2xl:w-64"
      />
    ),
  }
)

export function SiteHeader() {
  const { isShowNavBackground } = useNavbarScrollOverlay()
  return (
    <header
      className={cn(
        'site-header fixed inset-x-0 top-0 z-40 w-full transition duration-200',
        {
          'bg-background/80': isShowNavBackground,
        }
      )}
    >
      {/* gap-2 on the narrowest phones: the support heart lives in this row at
          every width now, and at 360px the three px a gap-3 costs came out of
          the search box's label. */}
      <div className="container flex h-16 max-w-(--breakpoint-2xl) items-center gap-2 sm:justify-between sm:gap-3 xl:gap-6">
        <MobileNav items={siteConfig.mainNav} />
        <BrandLogo />
        <MainNav items={siteConfig.mainNav} />
        {/* min-w-0 so this cluster is the side that gives when space runs out —
            without it a flex item refuses to shrink below its content and the
            nav is what buckles, which is how the labels ended up on two lines. */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="w-full min-w-0 flex-1 md:w-auto md:flex-none">
            <CommandMenu />
          </div>
          {/* Outside the `md:flex` nav below, deliberately. On a phone the only
              routes to the plans were the drawer and the footer — one behind a
              hamburger and a scroll, the other at the very bottom of every page.
              This is the one control on the site that has to be a single tap
              from anywhere, so it sits in the always-visible cluster.

              Shown to supporters too, and pointing at the same page: for them it
              is where the plan is managed. Rendering it unconditionally is also
              what keeps the icon row from shifting sideways once the browser
              works out who is looking. */}
          <SupportLink
            surface="header"
            aria-label="Support Reely"
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'text-primary hover:text-primary shrink-0'
            )}
          >
            <Heart className="size-5" />
          </SupportLink>
          <nav className="hidden shrink-0 items-center gap-1 md:flex">
            <Popover>
              <PopoverTrigger
                aria-label="Our apps on Google Play"
                className={buttonVariants({ size: 'icon', variant: 'ghost' })}
              >
                <Icons.googlePlay className="size-5" />
                <span className="sr-only">Our apps on Google Play</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                <PopoverHeading>Our apps on Google Play</PopoverHeading>
                {COMPANION_APPS.map((app) => (
                  <PopoverRow
                    key={app.slug}
                    Icon={Icons.googlePlay}
                    title={app.name}
                    subtitle={app.tagline}
                    onClick={() => openOnPlayStore(app)}
                  />
                ))}
              </PopoverContent>
            </Popover>
            {/* GitHub, X, portfolio and the tip jar used to be four separate
                icon buttons out here. Five buttons plus a 16rem search plus six
                nav labels does not fit the 1400px container, so they live
                behind one trigger — same links, a fifth of the width, and the
                list is the one the drawer already renders. */}
            <Popover>
              <PopoverTrigger
                aria-label="Links"
                className={buttonVariants({ size: 'icon', variant: 'ghost' })}
              >
                <Icons.moreHorizontal className="size-5" />
                <span className="sr-only">Links</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <PopoverHeading>Links</PopoverHeading>
                {EXTERNAL_LINKS.map((link) => (
                  <PopoverRow
                    key={link.label}
                    Icon={Icons[link.icon]}
                    iconClassName={link.iconClassName}
                    title={link.label}
                    href={link.href}
                    external
                  />
                ))}
              </PopoverContent>
            </Popover>
          </nav>
          {/* Outside the `md:flex` nav on purpose: the two popovers above are
              desktop conveniences, but signing in is the one control that has to
              be reachable on a phone, where most of this site is used. It is a
              fixed-size slot at every width, so the header never reflows when it
              settles. */}
          <AccountControl />
        </div>
      </div>
    </header>
  )
}
