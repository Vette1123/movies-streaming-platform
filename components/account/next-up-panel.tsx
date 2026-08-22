'use client'

import Link from 'next/link'
import { Play, PlayCircle } from 'lucide-react'

import type { NextUpItem } from '@/lib/nextup/routes'
import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useNextUp } from '@/hooks/use-next-up'
import { buttonVariants } from '@/components/ui/button'
import { SkeletonMediaRows } from '@/components/ui/skeleton'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

import { SupporterGate } from './supporter-gate'

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * The queue: one row per title you have started — films included, newest first.
 *
 * Everything here comes from what you actually played (episodes ticked off,
 * plays recorded in history, positions saved by the player), so the panel
 * knows where somebody is without being told and without a "mark progress"
 * step. The link goes straight to the episode — or the film's exact resume
 * position — two taps from opening this page to watching, which is the entire
 * point of the section. Live via useNextUp: play something anywhere and this
 * reshuffles without a reload.
 */
export function NextUpPanel() {
  const { pro } = useAccount()
  const { items, started, state } = useNextUp(pro)

  if (!pro) {
    return (
      <SupporterGate
        title="Everything you are in the middle of, one tap from playing"
        Icon={PlayCircle}
        surface="next-up"
        cta="Unlock your queue"
      >
        Reely already knows every episode you have ticked off and every film you
        have started. Supporting turns that into a queue: each title you have
        going, the exact spot you stopped — down to the minute on our own player
        — and a link that opens straight onto it. No &ldquo;which one was I
        on&rdquo;, no scrolling a season list to find the first one you have not
        seen — and it follows you between your phone and your laptop, because
        your progress does.
      </SupporterGate>
    )
  }

  if (state === 'loading') {
    return <SkeletonMediaRows rows={4} />
  }

  if (state === 'failed') {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        The queue is not reachable at the moment. Nothing is lost — your
        progress is stored on your account either way.
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[60ch] space-y-4 rounded-lg border border-dashed p-5">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {emptyCopy(started)}
        </p>
        <Link
          href="/tv-shows"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Find a show
        </Link>
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <NextUpRow key={`${item.kind}:${item.id}`} item={item} />
      ))}
    </ul>
  )
}

/**
 * Which nothing this is.
 *
 * "Caught up on everything" and "you have not started anything" are the same
 * empty list and opposite feelings, and the second one needs a nudge while the
 * first deserves to be told it is an achievement.
 */
function emptyCopy(started: number): string {
  if (started === 0) {
    return 'Nothing started yet. Press play on anything — a film tonight, an episode tomorrow — and it becomes the fastest way back: every title you have going, the exact spot you stopped, one tap from playing.'
  }
  return `You are caught up on all ${started} ${started === 1 ? 'title' : 'titles'} you have going. This fills in again the moment you start something new or one of them airs an episode — your alerts and calendar will tell you when that is.`
}

/** The line under the title: where this row will land you. */
function rowMeta(item: NextUpItem): string {
  if (
    item.kind === 'series' &&
    item.season !== undefined &&
    item.episode !== undefined
  ) {
    return `Up next · S${pad(item.season)}E${pad(item.episode)}`
  }
  if (typeof item.percent === 'number') return `Resume · ${item.percent}% in`
  return 'Resume'
}

function NextUpRow({ item }: { item: NextUpItem }) {
  const isSeries = item.kind === 'series'
  const hasBar = typeof item.percent === 'number'
  return (
    <li>
      <Link
        href={item.href}
        className="group border-border/60 hover:border-primary/40 hover:bg-card/60 flex items-center gap-4 rounded-lg border p-3 transition-colors"
      >
        <div className="w-14 shrink-0 sm:w-16">
          {item.poster_path ? (
            <BlurredImage
              src={getPosterImageURL(item.poster_path)}
              alt={item.name}
              width={185}
              height={278}
              quality={POSTER_QUALITY}
              // Fixed at 4rem, so `sizes` says so rather than guessing from the
              // grid — see lib/image-loader.ts.
              sizes="4rem"
              className="aspect-2/3 w-full rounded object-cover"
            />
          ) : (
            <MediaPosterFallback
              itemType={isSeries ? 'tv' : 'movie'}
              title={item.name}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {rowMeta(item)}
          </p>
          {/* The bar is the reason somebody comes back: progress you can see is
              progress worth finishing. Films only show one when the synced
              playback position knows how far in they are — no invented bars. */}
          {hasBar && (
            <div
              className="bg-muted h-1 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={item.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${item.percent}% of ${item.name} watched`}
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${item.percent}%` }}
              />
            </div>
          )}
        </div>

        <Play className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
      </Link>
    </li>
  )
}
