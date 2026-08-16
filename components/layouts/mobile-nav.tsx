import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, Heart, Smartphone } from 'lucide-react'

import { NavItem } from '@/types/navbar'
import { siteConfig } from '@/config/site'
import { SUPPORT_PRICES } from '@/config/support'
import { trackSupportCtaClicked } from '@/lib/analytics'
import { COMPANION_APPS, EXTERNAL_LINKS, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { AccountDrawerSection } from '@/components/account/account-drawer-section'
import { Icons } from '@/components/icons'
import {
  DrawerAction,
  DrawerSection,
  type DrawerActionProps,
} from '@/components/layouts/drawer-action'

interface MobileNavProps {
  items?: NavItem[]
}

type DrawerLink = Pick<
  DrawerActionProps,
  | 'href'
  | 'label'
  | 'Icon'
  | 'hint'
  | 'ariaLabel'
  | 'iconClassName'
  | 'tone'
  | 'external'
>

// Our own products that aren't on Google Play.
const TOOL_LINKS: DrawerLink[] = [
  {
    href: siteConfig.links.socialDownloader,
    label: 'Social Downloader',
    Icon: Download,
    hint: 'Web',
    tone: 'brand',
    external: true,
  },
]

// Same list the header popover renders — see EXTERNAL_LINKS. It was duplicated
// here, which is how the two ended up showing different sets.
const SOCIAL_LINKS: DrawerLink[] = EXTERNAL_LINKS.map(
  ({ label, href, icon, iconClassName }) => ({
    label,
    href,
    Icon: Icons[icon],
    iconClassName,
    external: true,
  })
)

/**
 * The plans, or the plan you are already on.
 *
 * Everyone sees a row here, signed in or not: this used to live only inside the
 * account menu, which meant a visitor with no account — most visitors — had no
 * route to the plans at all and the footer link was the entire funnel.
 *
 * A supporter gets the same row pointing at the same page, worded as management
 * rather than a sale. "From $5/mo" under a heading that asks them to support is
 * the site asking for money it has already been given, which is precisely what
 * the support page promises never to do again.
 */
function SupportDrawerSection({ onNavigate }: { onNavigate: () => void }) {
  const { ready, pro } = useAccountIdentity()
  const supporter = ready && pro

  return (
    <DrawerSection title={supporter ? 'Your plan' : 'Support Reely'}>
      <DrawerAction
        Icon={Heart}
        href="/support"
        label={supporter ? 'Manage membership' : 'Support Reely'}
        hint={supporter ? undefined : `From $${SUPPORT_PRICES.monthly}/mo`}
        tone="accent"
        onClick={() => {
          if (!supporter) trackSupportCtaClicked({ surface: 'drawer' })
          onNavigate()
        }}
      />
    </DrawerSection>
  )
}

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()
  const { canPrompt, needsIosHint, promptInstall } = usePwaInstall()
  const close = React.useCallback(() => setIsOpen(false), [])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          // xl:hidden, matching MainNav's xl:flex — the two must switch on the
          // same breakpoint or a width exists with both or neither.
          className="mr-2 shrink-0 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 xl:hidden"
        >
          <Icons.menu className="size-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="inset-y-0 flex h-full w-[350px] flex-col p-0"
      >
        <div className="shrink-0 px-6 py-4">
          <Link
            aria-label="Home"
            href="/"
            className="flex w-fit items-center"
            onClick={close}
          >
            <Icons.reelLogo className="mr-2 size-6" aria-hidden="true" />
            <span className="text-lg font-bold">{siteConfig.name}</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <nav className="divide-border/60 flex flex-col divide-y px-6 pb-4">
            {items?.map((item) => (
              <MobileLink
                key={item.title}
                href={item.href!}
                pathname={pathname}
                setIsOpen={setIsOpen}
                disabled={item.disabled}
                scroll={item.scroll}
              >
                {item.title}
              </MobileLink>
            ))}
          </nav>
          {/* The fixed PWA install nudge floats over the drawer's last row, so
              leave room for it while it can still appear. */}
          <div
            className={cn(
              'space-y-6 px-6 pt-2',
              canPrompt || needsIosHint ? 'pb-28' : 'pb-10'
            )}
          >
            <SupportDrawerSection onNavigate={close} />
            <AccountDrawerSection onNavigate={close} />
            <DrawerSection title="Apps & tools">
              {canPrompt && (
                <DrawerAction
                  Icon={Smartphone}
                  label="Install app"
                  tone="accent"
                  onClick={async () => {
                    close()
                    await promptInstall()
                  }}
                />
              )}
              {COMPANION_APPS.map((app) => (
                <DrawerAction
                  key={app.slug}
                  Icon={Icons.googlePlay}
                  label={app.name}
                  hint="Google Play"
                  tone="brand"
                  onClick={() => {
                    close()
                    openOnPlayStore(app)
                  }}
                />
              ))}
              {TOOL_LINKS.map((link) => (
                <DrawerAction key={link.label} {...link} onClick={close} />
              ))}
            </DrawerSection>
            <DrawerSection title="Connect">
              {SOCIAL_LINKS.map((link) => (
                <DrawerAction key={link.label} {...link} onClick={close} />
              ))}
            </DrawerSection>
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
      // Prefetched, deliberately. These links only exist while the drawer is
      // open, so opening it IS the intent signal — by the time a thumb reaches a
      // row its route payload has already landed and the tap paints instantly.
      // The cost is a handful of prerendered static assets (a 493-byte route
      // tree plus the page segment, ~12KB); they're matched by Workers Static
      // Assets ahead of the Worker, so they cost no invocation and can't trip
      // the WAF rate limit the card links have to worry about.
      className={cn(
        'text-foreground/70 hover:text-foreground flex h-11 items-center text-base font-medium transition-colors',
        pathname === href && 'text-secondary-foreground',
        disabled && 'pointer-events-none opacity-60'
      )}
      onClick={() => setIsOpen(false)}
    >
      {children}
    </Link>
  )
}
