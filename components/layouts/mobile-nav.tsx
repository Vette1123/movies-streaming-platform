import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, Smartphone } from 'lucide-react'

import { NavItem } from '@/types/navbar'
import { siteConfig } from '@/config/site'
import { COMPANION_APPS, openOnPlayStore } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

interface MobileNavProps {
  items?: NavItem[]
}

// Every action in the drawer footer — install prompt, Play Store apps, external
// links — renders through one row template so icon size, gap, height and label
// alignment can't drift apart again. Tone is the *only* thing that varies, and
// it maps to hierarchy: accent = the one primary CTA, brand = our own products,
// muted = everything else.
type DrawerTone = 'accent' | 'brand' | 'muted'

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

interface DrawerActionProps {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  /** Right-aligned qualifier, e.g. where the link goes. */
  hint?: string
  tone?: DrawerTone
  iconClassName?: string
  ariaLabel?: string
  /** Present → renders an external <Link>; absent → a <button>. */
  href?: string
  onClick?: () => void
}

function DrawerAction({
  Icon,
  label,
  hint,
  tone = 'muted',
  iconClassName,
  ariaLabel,
  href,
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
    return (
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
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

function DrawerSection({
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

type DrawerLink = Pick<
  DrawerActionProps,
  'href' | 'label' | 'Icon' | 'hint' | 'ariaLabel' | 'iconClassName' | 'tone'
>

// Our own products that aren't on Google Play.
const TOOL_LINKS: DrawerLink[] = [
  {
    href: siteConfig.links.socialDownloader,
    label: 'Social Downloader',
    Icon: Download,
    hint: 'Web',
    tone: 'brand',
  },
]

const SOCIAL_LINKS: DrawerLink[] = [
  {
    href: siteConfig.links.website,
    label: 'Portfolio',
    Icon: Icons.portfolio,
  },
  {
    href: siteConfig.links.github,
    label: 'GitHub',
    Icon: Icons.gitHub,
  },
  {
    href: siteConfig.links.twitter,
    label: 'X (Twitter)',
    Icon: Icons.twitter,
    iconClassName: 'fill-current',
  },
  {
    href: siteConfig.links.buyMeACoffee,
    label: 'Buy me a coffee',
    Icon: Icons.buyMeACoffee,
  },
]

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
        <div className="shrink-0 px-6 py-4">
          <Link
            aria-label="Home"
            href="/"
            prefetch={false}
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
      prefetch={false}
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
