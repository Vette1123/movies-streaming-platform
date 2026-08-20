'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Star, X } from 'lucide-react'

import type { ForYouItem } from '@/lib/foryou/routes'
import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useHiddenMedia } from '@/hooks/use-hidden-media'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  const { hide, hiddenIds } = useHiddenMedia()
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
      <div className="space-y-5">
        <Skeleton className="h-4 w-2/3 max-w-sm" />
        <ul
          aria-hidden
          className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <li
              key={i}
              className="space-y-2"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Skeleton className="aspect-2/3 w-full rounded-lg" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-1/2" />
            </li>
          ))}
        </ul>
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
        {/* Filtered here as well as on the server. The server excludes hidden
            titles from the NEXT response; this is what makes the tile you just
            dismissed disappear now, without a refetch. */}
        {items
          .filter((item) => !hiddenIds.has(item.id))
          .map((item) => (
            <li key={`${item.type}-${item.id}`} className="relative">
              <Tile item={item} />
              <button
                type="button"
                aria-label={`Not interested in ${item.title}`}
                title="Not interested"
                onClick={() =>
                  hide({
                    id: item.id,
                    // A ForYouItem has one title field, and which of the two
                    // WatchedSource slots it goes in is what decides movie vs
                    // series downstream.
                    ...(item.type === 'movie'
                      ? { title: item.title }
                      : { name: item.title }),
                    poster_path: item.poster_path,
                  })
                }
                className="bg-background/80 text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full opacity-0 backdrop-blur-sm transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden group-hover/tile:opacity-100 max-md:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

/**
 * Why this is here, in the strongest form the data supports.
 *
 * "Because you rated X 9" is a far better line than "Because of X": it says the
 * recommendation came from something the person actually told us, not from
 * whatever happened to be on last. It only appears when a score is what picked
 * the seed — see chooseSeeds in lib/foryou/routes.ts.
 */
const becauseLine = (item: ForYouItem): string =>
  item.because_rating === null
    ? `Because of ${item.because}`
    : `Because you rated ${item.because} ${item.because_rating}`

/** "A, B and C" — an Oxford-less list, because it is prose, not data. */
function listOf(titles: string[]): string {
  if (titles.length === 1) return titles[0]
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`
}

function Tile({ item }: { item: ForYouItem }) {
  return (
    <Link href={item.href} className="group/tile group block space-y-2">
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
          {becauseLine(item)}
        </p>
      </div>
    </Link>
  )
}
