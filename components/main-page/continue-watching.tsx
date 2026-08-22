'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

import { trackSupportCtaClicked } from '@/lib/analytics'
import type { NextUpItem } from '@/lib/nextup/routes'
import { getPosterImageURL } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { readStore } from '@/hooks/use-local-storage'
import { useNextUp } from '@/hooks/use-next-up'
import { buttonVariants } from '@/components/ui/button'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'
import { SeeAllLink } from '@/components/see-all-link'

/**
 * Where you left off, at the top of the homepage.
 *
 * The queue is computed by `/api/next-up` — see lib/nextup — and this is the
 * surface that makes it worth having. A feature that lives at `/next-up` is a
 * feature nobody opens; the same rows on the page everybody lands on are the
 * reason to open Reely rather than the other tab.
 *
 * Three things keep it honest on a static homepage:
 *
 *  - **It renders nothing until it has something.** No skeleton, no reserved
 *    band. The homepage's first paint is unchanged for everyone who is signed
 *    out, which is almost everybody, and the hero never moves.
 *  - **Supporters only make the request.** One Worker invocation, for the
 *    people paying for the queue, on a page that is otherwise a static asset.
 *  - **Everyone else sees the offer at most once, and only if they have
 *    progress worth carrying.** Somebody with no episodes ticked off is not
 *    shown a pitch for a queue they would have nothing in.
 *
 * And one thing keeps it alive: `useNextUp` re-reads whenever a sync settles or
 * attention returns, so pressing play anywhere — this device or another —
 * reshuffles this row without a reload.
 */
export function ContinueWatching() {
  const { pro, ready } = useAccountIdentity()
  const { items } = useNextUp(pro && ready)
  const [localProgress, setLocalProgress] = useState(false)

  useEffect(() => {
    if (!ready) return

    if (!pro) {
      // localStorage has no server answer, so the first client pass is the
      // earliest anything can read it. Only the fact that there IS progress is
      // needed, not what it is.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalProgress(readStore('completedItems').length > 0)
      return
    }
  }, [pro, ready])

  if (!pro) {
    if (!localProgress) return null
    return <CarryItOver />
  }

  if (items.length === 0) return null

  return (
    <section className="px-5 pt-8 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span
            aria-hidden
            // The same accent bar every rail heading carries, in the primary
            // colour rather than the rails' cyan: this row is yours, and the
            // rest of the page is the catalogue.
            className="bg-primary h-5 w-[3px] origin-center rounded-full"
          />
          Pick up where you left off
        </h2>
        <SeeAllLink href="/next-up" label="Your queue" />
      </div>

      {/* A scroller rather than a grid, for the same reason as every other rail:
          a row that wraps to three lines on a phone is not a row. */}
      <ul className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <li key={item.id} className="w-40 shrink-0 snap-start sm:w-44">
            <Tile item={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The one line under the title. A show says where it will land; a film says how much is behind you. */
function tileMeta(item: NextUpItem): string {
  if (
    item.kind === 'series' &&
    item.season !== undefined &&
    item.episode !== undefined
  ) {
    return `S${pad(item.season)}E${pad(item.episode)}`
  }
  if (typeof item.percent === 'number') return `${item.percent}% · resume`
  return 'Resume'
}

function Tile({ item }: { item: NextUpItem }) {
  const isSeries = item.kind === 'series'
  return (
    <Link href={item.href} className="group block space-y-2">
      <div className="relative overflow-hidden rounded-lg">
        {item.poster_path ? (
          <BlurredImage
            src={getPosterImageURL(item.poster_path)}
            alt={item.name}
            width={342}
            height={513}
            quality={POSTER_QUALITY}
            // Fixed-width tiles, so `sizes` says the painted width rather than
            // a viewport fraction — see lib/image-loader.ts.
            sizes="11rem"
            className="aspect-2/3 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <MediaPosterFallback
            itemType={isSeries ? 'tv' : 'movie'}
            title={item.name}
          />
        )}

        {/* Over the poster, not under it: the row is about resuming, and the
            play affordance has to be the thing the eye lands on. On touch there
            is no hover, so the scrim keeps the tile legible instead of relying
            on it appearing. */}
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/45 via-transparent to-transparent transition-colors group-hover:bg-black/40">
          <Play className="size-8 text-white opacity-90 drop-shadow-lg transition-opacity lg:opacity-0 lg:group-hover:opacity-100" />
        </div>

        {typeof item.percent === 'number' && (
          <div
            className="absolute inset-x-0 bottom-0 h-1 bg-black/50"
            role="progressbar"
            aria-valuenow={item.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.percent}% of ${item.name} watched`}
          >
            <div
              className="bg-primary h-full transition-[width] duration-700 ease-out"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        <p className="group-hover:text-primary truncate text-sm font-medium transition-colors">
          {item.name}
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          {tileMeta(item)}
        </p>
      </div>
    </Link>
  )
}

/**
 * The offer, for somebody who is already tracking episodes in this browser.
 *
 * Shown only to people whose own data would fill the row — a pitch for a queue
 * is meaningless to somebody with nothing in it, and showing it to them anyway
 * is how a homepage starts feeling like a shop.
 */
function CarryItOver() {
  return (
    <section className="px-5 pt-8 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <div className="border-primary/25 from-primary/10 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-linear-to-br to-transparent px-5 py-4">
        <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
          <span className="text-foreground font-medium">
            You are part-way through something.
          </span>{' '}
          Supporters get that as a row right here — everything they have going,
          the exact spot they stopped, one tap from playing, on every device
          they sign in on.
        </p>
        <Link
          href="/support"
          onClick={() => trackSupportCtaClicked({ surface: 'home_continue' })}
          className={buttonVariants({ size: 'sm' })}
        >
          See what support unlocks
        </Link>
      </div>
    </section>
  )
}
