'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { COMPANION_APPS, EXTERNAL_LINKS, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { useNavbarScrollOverlay } from '@/hooks/use-scroll-overlay'
import { buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { AccountControl } from '@/components/account/account-control'
import { Icons } from '@/components/icons'
import { BrandLogo, MainNav } from '@/components/layouts/main-nav'
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
        // Widths must track the real trigger in command-menu.tsx, or the swap
        // shifts the header.
        className="bg-muted/40 h-9 w-full animate-pulse rounded-md border md:w-44 xl:w-52 2xl:w-64"
      />
    ),
  }
)

// Both header popovers render the same row: icon, title, optional second line.
// One template so the apps list and the links list can't drift apart on icon
// size, gap or hover treatment — the drawer's DrawerAction is the same idea.
const POPOVER_ROW =
  'hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left outline-none'

function PopoverHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs font-medium">
      {children}
    </p>
  )
}

interface PopoverRowProps {
  Icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  iconClassName?: string
  /** Present → renders an external link; absent → a button. */
  href?: string
  onClick?: () => void
}

function PopoverRow({
  Icon,
  title,
  subtitle,
  iconClassName,
  href,
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
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        className={POPOVER_ROW}
      >
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={POPOVER_ROW}>
      {content}
    </button>
  )
}

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
      <div className="container flex h-16 max-w-(--breakpoint-2xl) items-center gap-3 sm:justify-between xl:gap-6">
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
