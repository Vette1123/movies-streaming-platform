'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Sparkles, Star } from 'lucide-react'

import type { ForYouItem } from '@/lib/foryou/routes'
import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

import { SupporterGate } from './supporter-gate'

type State = 'loading' | 'ready' | 'failed'

/**
 * Because you watched.
 *
 * TMDB's recommendations, pointed at the last few things this account actually
 * finished rather than at whatever page somebody happens to be on, with the
 * whole library filtered back out. Every row says which of your titles it came
 * from, because a recommendation you cannot trace is indistinguishable from an
 * advert.
 */
export function ForYouPanel() {
  const { pro } = useAccount()
  const [items, setItems] = useState<ForYouItem[]>([])
  const [seeds, setSeeds] = useState<string[]>([])
  const [state, setState] = useState<State>('loading')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/for-you')
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setState('failed')
        return
      }
      setItems(body.items ?? [])
      setSeeds(body.seeds ?? [])
      setState('ready')
    } catch {
      setState('failed')
    }
  }, [])

  useEffect(() => {
    if (!pro) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [pro, load])

  if (!pro) {
    return (
      <SupporterGate
        title="Suggestions that read your history, not the page you are on"
        Icon={Sparkles}
        surface="for-you"
        cta="Unlock your suggestions"
      >
        Every detail page already shows &ldquo;more like this one&rdquo;. This
        is the other thing: what to watch tonight, worked out from the last
        films and shows you actually finished, with everything already on your
        watchlist or in your history taken back out — so nothing here is
        something you have seen or already decided about. Each one says which of
        your titles it came from.
      </SupporterGate>
    )
  }

  if (state === 'loading') {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" /> Reading your taste
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Suggestions are not reachable at the moment. Try this section again in a
        minute.
      </p>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-[60ch] space-y-4 rounded-lg border border-dashed p-5">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {seeds.length === 0
            ? 'Nothing to go on yet. Finish a film or tick an episode off and this fills in from what you watched — no survey, no thumbs, no setup.'
            : 'Nothing new to suggest right now: everything the last few titles point at is already in your library. Watch something different and this changes.'}
        </p>
        <Link
          href="/movies"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Browse films
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {seeds.length > 0 && (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Worked out from {listOf(seeds)}. Anything already on your watchlist or
          in your history has been left out.
        </p>
      )}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <Tile item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "A, B and C" — an Oxford-less list, because it is prose, not data. */
function listOf(titles: string[]): string {
  if (titles.length === 1) return titles[0]
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`
}

function Tile({ item }: { item: ForYouItem }) {
  return (
    <Link href={item.href} className="group block space-y-2">
      <div className="relative overflow-hidden rounded-lg">
        {item.poster_path ? (
          <BlurredImage
            src={getPosterImageURL(item.poster_path)}
            alt={item.title}
            width={342}
            height={513}
            quality={POSTER_QUALITY}
            // Five up inside the console's content column at desktop, three up
            // on a phone. `sizes` describes what is painted — see
            // lib/image-loader.ts.
            sizes="(min-width: 1024px) 9rem, (min-width: 640px) 20vw, 28vw"
            className="aspect-2/3 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <MediaPosterFallback
            itemType={item.type === 'series' ? 'tv' : 'movie'}
            title={item.title}
          />
        )}
        {item.vote_average !== null && (
          <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-sm">
            <Star className="size-2.5 fill-amber-300 text-amber-300" />
            {item.vote_average}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="group-hover:text-primary truncate text-xs font-medium transition-colors">
          {item.title}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          Because of {item.because}
        </p>
      </div>
    </Link>
  )
}
