'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { OFFERS, type Offer, type OfferPlacement } from '@/config/offers'
import { trackFeatureUsed } from '@/lib/analytics'
import {
  offerHref,
  offerRel,
  pagePlacement,
  selectOffer,
  todayUtc,
} from '@/lib/offers'
import { cn } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'

const noSubscribe = () => () => {}
const serverDay = () => null

/**
 * The offer a placement shows right now. null while prerendering and
 * hydrating (built on one day, hydrated on another), the real date from then
 * on: see selectOffer. Shared with the footer's app strip, so it can leave out
 * the app the card above it is already showing.
 */
export function useSlotOffer(placement: OfferPlacement | null): Offer | null {
  const today = useSyncExternalStore(noSubscribe, todayUtc, serverDay)
  return useMemo(
    () => (placement ? selectOffer(OFFERS, placement, today) : null),
    [placement, today]
  )
}

/**
 * The sponsor card: under the hero on the homepage and on every film and
 * episode page, and above the footer on almost every other page
 * (`SiteSponsorSlot`). One per page, never on top of the video, no popup, and
 * never for a supporter.
 *
 * It is in the static HTML, so it paints with the page instead of pushing it
 * down after hydration. A supporter's cached profile sets `data-pro` on <html>
 * before the first paint (APPEARANCE_BOOT_SCRIPT), and styles/globals.css hides
 * `.sponsor-slot` under it, so they never see it flash either.
 *
 * Rendered by Reely itself, so there is no ad network, no third-party script
 * and no pixel; the impression and the click are our own
 * `feature_used {feature: 'sponsor'}`, which is also the report a sponsor gets.
 * Catalogue: config/offers.ts.
 */
export function SponsorSlot({
  placement,
  className,
}: {
  placement: OfferPlacement
  className?: string
}) {
  const { ready, pro } = useAccountIdentity()
  const offer = useSlotOffer(placement)

  // Keep the pre-paint flag true to the account, so a sign-out shows the card
  // on the next page and a fresh upgrade hides it on this one.
  useEffect(() => {
    if (!ready) return
    const flags = document.documentElement.dataset
    if (pro) flags.pro = '1'
    else delete flags.pro
  }, [ready, pro])

  if ((ready && pro) || !offer) return null
  return (
    <div className={cn('sponsor-slot', className)}>
      <SponsorCard offer={offer} placement={placement} counted={ready} />
    </div>
  )
}

/** The card above the footer, on every page that has no slot of its own. */
export function SiteSponsorSlot() {
  const placement = pagePlacement(usePathname())
  if (!placement) return null
  return (
    <SponsorSlot
      // Keyed by placement only: a navigation between two pages keeps the
      // same card, and its impression, instead of remounting it.
      key={placement}
      placement={placement}
      className="container max-w-(--breakpoint-2xl) pt-10 pb-2"
    />
  )
}

/**
 * One card. `preview` is the copy on /advertise: same component, so the page
 * shows exactly what a sponsor buys, but it counts nothing and links nowhere.
 * `counted` holds the impression until the account has settled, so a
 * supporter whose card is about to go never counts as a view.
 */
export function SponsorCard({
  offer,
  placement,
  preview = false,
  counted = true,
}: {
  offer: Offer
  placement: OfferPlacement
  preview?: boolean
  counted?: boolean
}) {
  // An impression is the card on screen, not the card in the DOM: the one
  // above the footer is on every page, and most of those visits never reach
  // it. That is the number a sponsor is sold, so it has to be the real one.
  const { ref, inView } = useInView({ threshold: 0.5, triggerOnce: true })

  useEffect(() => {
    if (preview || !counted || !inView) return
    trackFeatureUsed({
      feature: 'sponsor',
      action: 'shown',
      offer: offer.id,
      placement,
    })
  }, [offer.id, placement, preview, counted, inView])

  const label = offer.ownApp
    ? 'From Reely’s maker'
    : `Sponsored · ${offer.sponsor}`

  return (
    <aside
      ref={ref}
      aria-label={offer.ownApp ? 'From Reely’s maker' : 'Sponsor'}
      className="sponsor-card rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <p className="min-w-0 wrap-anywhere">{label}</p>
        {preview ? null : (
          <p className="flex shrink-0 flex-wrap gap-x-3">
            <Link
              href="/support"
              onClick={() =>
                trackFeatureUsed({
                  feature: 'sponsor',
                  action: 'remove_clicked',
                  offer: offer.id,
                  placement,
                })
              }
              className="tap-target underline-offset-4 hover:text-foreground hover:underline"
            >
              Remove with Pro
            </Link>
            <Link
              href="/advertise"
              className="tap-target underline-offset-4 hover:text-foreground hover:underline"
            >
              Advertise here
            </Link>
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-4 sm:items-center">
        {offer.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, already the shown size
          <img
            src={offer.image}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="size-12 shrink-0 rounded-xl"
          />
        ) : null}
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-base font-semibold text-balance wrap-anywhere text-foreground">
            {offer.headline}
          </p>
          <p className="mt-1 max-w-[62ch] leading-relaxed text-pretty text-muted-foreground">
            {offer.body}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {offer.coupon ? (
            <Coupon offer={offer} placement={placement} preview={preview} />
          ) : null}
          <a
            href={preview ? '#contact' : offerHref(offer, placement)}
            target={preview ? undefined : '_blank'}
            rel={preview ? undefined : offerRel(offer)}
            onClick={() => {
              if (preview) return
              trackFeatureUsed({
                feature: 'sponsor',
                action: 'click',
                offer: offer.id,
                placement,
              })
            }}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-auto min-h-8 max-w-full flex-1 py-1.5 text-center whitespace-normal transition-transform duration-150 ease-out active:scale-[0.97] sm:flex-none'
            )}
          >
            {offer.cta}
            {preview ? null : (
              <span className="sr-only"> (opens in a new tab)</span>
            )}
          </a>
        </div>
      </div>
    </aside>
  )
}

/** The code as text anyone can select, and a button that copies it. */
function Coupon({
  offer,
  placement,
  preview,
}: {
  offer: Offer
  placement: OfferPlacement
  preview: boolean
}) {
  const [copied, setCopied] = useState(false)
  const coupon = offer.coupon!

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(coupon.code)
          setCopied(true)
          if (preview) return
          trackFeatureUsed({
            feature: 'sponsor',
            action: 'coupon_copied',
            offer: offer.id,
            placement,
          })
        } catch {
          // Clipboard refused (permissions, insecure context): the code is on
          // screen to type, which is all this button adds to.
          if (preview) return
          trackFeatureUsed({
            feature: 'sponsor',
            action: 'coupon_copied',
            outcome: 'denied',
            offer: offer.id,
            placement,
          })
        }
      }}
      aria-label={`Copy code ${coupon.code}, ${coupon.saving}`}
      className="inline-flex max-w-full flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-md border border-dashed border-primary/50 px-3 py-1.5 text-sm transition-transform duration-150 ease-out active:scale-[0.97] sm:flex-none"
    >
      <span className="min-w-0 font-semibold tracking-wide wrap-anywhere text-foreground tabular-nums">
        {coupon.code}
      </span>
      <span className="text-muted-foreground">{coupon.saving}</span>
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Copy aria-hidden className="size-4 text-muted-foreground" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  )
}
