'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Play, PlayCircle } from 'lucide-react'

import type { NextUpItem } from '@/lib/nextup/routes'
import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

import { SupporterGate } from './supporter-gate'

type State = 'loading' | 'ready' | 'failed'

const pad = (value: number) => String(value).padStart(2, '0')

const episodeLabel = (item: NextUpItem): string =>
  `S${pad(item.season)}E${pad(item.episode)}`

/**
 * The queue: one row per show you have started, newest first.
 *
 * Everything here comes from episodes already ticked off, so the panel knows
 * where somebody is without being told and without a "mark progress" step. The
 * link goes straight to the episode with the player deep-link already on it —
 * two taps from opening the account page to watching, which is the entire point
 * of the section.
 */
export function NextUpPanel() {
  const { pro } = useAccount()
  const [items, setItems] = useState<NextUpItem[]>([])
  const [started, setStarted] = useState(0)
  const [state, setState] = useState<State>('loading')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/next-up')
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setState('failed')
        return
      }
      setItems(body.items ?? [])
      setStarted(body.started ?? 0)
      setState('ready')
    } catch {
      setState('failed')
    }
  }, [])

  useEffect(() => {
    if (!pro) return
    // Same shape as the schedule panel: a fetch is what an effect is for, and
    // the rule only fires because the failure path settles state synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [pro, load])

  if (!pro) {
    return (
      <SupporterGate
        title="Every show you are in the middle of, one tap from playing"
        Icon={PlayCircle}
        surface="next-up"
        cta="Unlock your queue"
      >
        Reely already knows every episode you have ticked off. Supporting turns
        that into a queue: each show you have started, the exact episode you are
        up to, how far through you are, and a link that opens the player on it.
        No &ldquo;which one was I on&rdquo;, no scrolling a season list to find
        the first one you have not seen — and it follows you between your phone
        and your laptop, because your progress does.
      </SupporterGate>
    )
  }

  if (state === 'loading') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" /> Working out where you are
      </div>
    )
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
        <NextUpRow key={item.id} item={item} />
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
    return 'Nothing started yet. Tick an episode off as you watch and this becomes the fastest way back into every show you have going — the exact episode you are up to, one tap from playing.'
  }
  return `You are caught up on all ${started} ${started === 1 ? 'show' : 'shows'} you have going. This fills in again the moment one of them airs something new — and your alerts and calendar will tell you when that is.`
}

function NextUpRow({ item }: { item: NextUpItem }) {
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
            <MediaPosterFallback itemType="tv" title={item.name} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            Up next &middot; {episodeLabel(item)}
          </p>
          {/* The bar is the reason somebody comes back: progress you can see is
              progress worth finishing. */}
          <div
            className="bg-muted h-1 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={item.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${item.percent}% of ${item.name} watched`}
          >
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        </div>

        <Play className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" />
      </Link>
    </li>
  )
}
