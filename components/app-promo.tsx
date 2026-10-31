'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useInView } from 'react-intersection-observer'

import { trackFeatureUsed } from '@/lib/analytics'
import { COMPANION_APPS } from '@/lib/apps'
import { pickPromo } from '@/lib/promo'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { StoreLink } from '@/components/store-link'

// Cross-promo for our own apps, one per route (see pickPromo). Everything is first party and the box is sized
// by its markup, so it costs no third-party script and no layout shift.
export function AppPromo({ placement }: { placement: string }) {
  const promo = pickPromo(usePathname() ?? '/')
  const app = COMPANION_APPS.find(({ slug }) => slug === promo.slug)
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.5 })

  useEffect(() => {
    if (!inView) return
    trackFeatureUsed({
      feature: 'promo_shown',
      action: promo.slug,
      placement,
    })
  }, [inView, placement, promo.slug])

  if (!app) return null

  return (
    <div ref={ref}>
      <StoreLink
        app={app}
        onOpen={() =>
          trackFeatureUsed({
            feature: 'promo_click',
            action: promo.slug,
            placement,
          })
        }
        className="group flex flex-wrap items-start gap-x-4 gap-y-3 font-normal sm:items-center text-muted-foreground hover:text-muted-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, already the shown size */}
        <img
          src={promo.image}
          alt={promo.name}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="size-12 shrink-0 rounded-xl"
        />
        <span className="min-w-0 flex-1 basis-40">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-foreground">
              {promo.headline}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
              Our app
            </span>
          </span>
          <span className="mt-1 block max-w-[62ch] leading-relaxed">
            {promo.body}
          </span>
        </span>
        <span
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full shrink-0 transition-transform duration-150 ease-out group-active:scale-[0.97] sm:w-auto'
          )}
        >
          {promo.cta}
        </span>
      </StoreLink>
    </div>
  )
}
