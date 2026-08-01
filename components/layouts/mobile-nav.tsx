import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download } from 'lucide-react'

import { NavItem } from '@/types/navbar'
import { siteConfig } from '@/config/site'
import { COMPANION_APPS, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

interface MobileNavProps {
  items?: NavItem[]
}

// External links in the drawer footer — all render as the same full-width
// button, so keep them as data and map one <Link> template instead of five
// hand-copied blocks that drifted apart (missing aria-labels, stray classes).
interface SocialLink {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  ariaLabel?: string
  iconClassName?: string
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    href: siteConfig.links.github,
    label: 'GitHub',
    Icon: Icons.gitHub,
    ariaLabel: 'GitHub',
  },
  {
    href: siteConfig.links.twitter,
    label: 'X (Twitter)',
    Icon: Icons.twitter,
    ariaLabel: 'X (Twitter)',
    iconClassName: 'fill-current',
  },
  {
    href: 'https://www.profitableratecpm.com/hwxt5zz7i?key=a5dba98951e6803fa620281826ca66d3',
    label: 'Support',
    Icon: Icons.buyMeACoffee,
  },
  {
    href: siteConfig.links.buyMeACoffee,
    label: 'Buy me a coffee',
    Icon: Icons.buyMeACoffee,
  },
  {
    href: siteConfig.links.website,
    label: 'Visit my portfolio',
    Icon: Icons.portfolio,
  },
]

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()
  const { canPrompt, promptInstall } = usePwaInstall()

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 lg:hidden"
        >
          <Icons.menu className="size-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="inset-y-0 flex h-full w-[350px] flex-col p-0"
      >
        <div className="shrink-0 px-7 py-4">
          <Link
            aria-label="Home"
            href="/"
            prefetch={false}
            className="flex w-fit items-center"
            onClick={() => setIsOpen(false)}
          >
            <Icons.reelLogo className="mr-2 size-6" aria-hidden="true" />
            <span className="text-lg font-bold">{siteConfig.name}</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-4 px-9 py-4">
            {items?.map((item, index) => (
              <div className="border-b-2 last:border-b-0" key={item.title}>
                <MobileLink
                  key={index}
                  href={item.href!}
                  pathname={pathname}
                  setIsOpen={setIsOpen}
                  disabled={item.disabled}
                  scroll={item.scroll}
                >
                  {item.title}
                </MobileLink>
              </div>
            ))}
          </div>
          <div className="space-y-3 px-9 pb-10">
            {canPrompt && (
              <button
                type="button"
                onClick={async () => {
                  setIsOpen(false)
                  await promptInstall()
                }}
                className={cn(
                  buttonVariants({
                    variant: 'default',
                    size: 'default',
                    className: 'w-full',
                  }),
                  'bg-gradient-to-br from-cyan-300 to-cyan-500 text-[#04121a]'
                )}
              >
                <Download className="mr-2 size-5" strokeWidth={2.5} />
                Install app
              </button>
            )}
            {COMPANION_APPS.map((app) => (
              <button
                key={app.slug}
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  openOnPlayStore(app)
                }}
                className={cn(
                  buttonVariants({
                    variant: 'default',
                    size: 'default',
                    className: 'w-full',
                  }),
                  'from-primary bg-gradient-to-r to-emerald-500 text-white'
                )}
              >
                <Icons.googlePlay className="mr-2 size-5" />
                Get {app.name} on Google Play
              </button>
            ))}
            {SOCIAL_LINKS.map(
              ({ href, label, Icon, ariaLabel, iconClassName }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={ariaLabel}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    buttonVariants({
                      variant: 'default',
                      size: 'default',
                      className: 'w-full',
                    }),
                    'text-white'
                  )}
                >
                  <Icon className={cn('mr-2 size-5', iconClassName)} />
                  {label}
                </Link>
              )
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface MobileLinkProps {
  children?: React.ReactNode
  href: string
  disabled?: boolean
  pathname: string
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  scroll?: boolean
}

function MobileLink({
  children,
  href,
  disabled,
  pathname,
  setIsOpen,
  scroll,
}: MobileLinkProps) {
  return (
    <Link
      href={href}
      scroll={scroll}
      prefetch={false}
      className={cn(
        'text-foreground/70 hover:text-foreground w-fit text-base font-medium transition-colors',
        pathname === href && 'text-secondary-foreground',
        disabled && 'pointer-events-none opacity-60'
      )}
      onClick={() => setIsOpen(false)}
    >
      {children}
    </Link>
  )
}
