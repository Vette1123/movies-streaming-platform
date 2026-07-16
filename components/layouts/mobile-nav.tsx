import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavItem } from '@/types/navbar'
import { siteConfig } from '@/config/site'
import { openRafiqOnPlayStore } from '@/lib/rafiq'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Icons } from '@/components/icons'

interface MobileNavProps {
  items?: NavItem[]
}

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

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
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                openRafiqOnPlayStore()
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
              Get Rafiq on Google Play
            </button>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
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
              <Icons.gitHub className="mr-2 size-5" />
              GitHub
            </Link>
            <Link
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noreferrer"
              aria-label="X (Twitter)"
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
              <Icons.twitter className="mr-2 size-5 fill-current" />
              X (Twitter)
            </Link>
            <Link
              href="https://www.profitableratecpm.com/hwxt5zz7i?key=a5dba98951e6803fa620281826ca66d3"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'default',
                  className: 'w-full',
                }),
                'text-white'
              )}
            >
              <Icons.buyMeACoffee className="mr-2 size-5" />
              Support
            </Link>
            <Link
              href={siteConfig.links.buyMeACoffee}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'default',
                  className: 'w-full',
                }),
                'text-white'
              )}
            >
              <Icons.buyMeACoffee className="mr-2 size-5" />
              Buy me a coffee
            </Link>
            <Link
              href={siteConfig.links.website}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'default',
                  className: 'w-full',
                }),
                'text-white'
              )}
            >
              <Icons.portfolio className="mr-2 size-5" />
              Visit my portfolio
            </Link>
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
