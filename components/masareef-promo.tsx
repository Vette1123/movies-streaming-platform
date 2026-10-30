'use client'

import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'

import { trackFeatureUsed } from '@/lib/analytics'
import { COMPANION_APPS } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { StoreLink } from '@/components/store-link'

const masareef = COMPANION_APPS.find((app) => app.slug === 'masareef')

// Cross-promo for our own app. Everything is first party and the box is sized
// by its markup, so it costs no third-party script and no layout shift.
export function MasareefPromo({ placement }: { placement: string }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.5 })

  useEffect(() => {
    if (!inView) return
    trackFeatureUsed({
      feature: 'promo_shown',
      action: 'masareef',
      placement,
    })
  }, [inView, placement])

  if (!masareef) return null

  return (
    <div ref={ref}>
      <StoreLink
        app={masareef}
        onOpen={() =>
          trackFeatureUsed({
            feature: 'promo_click',
            action: 'masareef',
            placement,
          })
        }
        className="group flex flex-wrap items-start gap-x-4 gap-y-3 font-normal sm:items-center text-muted-foreground hover:text-muted-foreground"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, already 80x80 */}
        <img
          src="/promo/masareef.png"
          alt="Masareef"
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="size-12 shrink-0 rounded-xl"
        />
        <span className="min-w-0 flex-1 basis-40">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-foreground">
              Know where your money went
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
              Our app
            </span>
          </span>
          <span className="mt-1 block max-w-[62ch] leading-relaxed">
            Masareef is an offline-first, multi-currency spending tracker, from
            the people behind this site.
          </span>
        </span>
        <span
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full shrink-0 transition-transform duration-150 ease-out group-active:scale-[0.97] sm:w-auto'
          )}
        >
          Get Masareef
        </span>
      </StoreLink>
    </div>
  )
}
