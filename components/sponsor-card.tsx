'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Copy } from 'lucide-react'

import { OFFERS, type Offer, type OfferPlacement } from '@/config/offers'
import { trackFeatureUsed } from '@/lib/analytics'
import { offerHref, offerRel, selectOffer, todayUtc } from '@/lib/offers'
import { cn } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'

/**
 * The one sponsor card, under the player once a title is playing.
 *
 * Nothing before play, nothing on top of the video, no popup: it is there when
 * somebody scrolls past the player and gone for a supporter. Rendered by Reely
 * itself, so there is no ad network, no third-party script and no pixel; the
 * impression and the click are our own `feature_used {feature: 'sponsor'}`,
 * which is also the report a sponsor gets. Catalogue: config/offers.ts.
 */
export function SponsorSlot({ placement }: { placement: OfferPlacement }) {
  const { ready, pro } = useAccountIdentity()
  // Read once per mount: the slot does not change under somebody mid-film.
  const offer = useMemo(
    () => selectOffer(OFFERS, placement, todayUtc()),
    [placement]
  )

  if (!ready || pro || !offer) return null
  return <SponsorCard offer={offer} placement={placement} />
}

/**
 * One card. `preview` is the copy on /advertise: same component, so the page
 * shows exactly what a sponsor buys, but it counts nothing and links nowhere.
 */
export function SponsorCard({
  offer,
  placement,
  preview = false,
}: {
  offer: Offer
  placement: OfferPlacement
  preview?: boolean
}) {
  useEffect(() => {
    if (preview) return
    trackFeatureUsed({
      feature: 'sponsor',
      action: 'shown',
      offer: offer.id,
      placement,
    })
  }, [offer.id, placement, preview])

  const label = offer.ownApp
    ? 'From Reely’s maker'
    : `Sponsored · ${offer.sponsor}`

  return (
    <aside
      aria-label={offer.ownApp ? 'From Reely’s maker' : 'Sponsor'}
      className="sponsor-card rounded-xl border border-border/60 bg-card/60 p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
        <p className="min-w-0 wrap-anywhere">{label}</p>
        {preview ? null : (
          <Link
            href="/advertise"
            className="shrink-0 underline-offset-4 hover:text-foreground hover:underline"
          >
            Advertise here
          </Link>
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
