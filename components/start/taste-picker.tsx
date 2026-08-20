'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Check, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import type { MediaType } from '@/types/media'
import { discoverApi } from '@/lib/api-client'
import {
  TASTE_MAX,
  TASTE_MIN,
  tastePrompt,
  tasteQuery,
  type TastePick,
} from '@/lib/taste'
import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import {
  buildWatchedItem,
  useLocalStorage,
  type WatchedItem,
} from '@/hooks/use-local-storage'
import { Button, buttonVariants } from '@/components/ui/button'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { Card } from '@/components/card'

/**
 * Five taps, then something to watch.
 *
 * The whole point is that the answer arrives before any ask does: pick, see
 * real recommendations, and only then get offered a way to keep them. Nothing
 * here needs an account — the watchlist it writes to is the same localStorage
 * one the rest of the site uses — which is what makes the sign-in line at the
 * end true rather than a gate.
 */
export function TastePicker({ candidates }: { candidates: TastePick[] }) {
  const { signedIn } = useAccount()
  const [picked, setPicked] = useState<TastePick[]>([])
  const [watchlist, setWatchlist] = useLocalStorage('watchlist', [])
  const [saved, setSaved] = useState(false)

  const suggest = useMutation({
    mutationFn: async (picks: TastePick[]) => {
      const { mediaType, params } = tasteQuery(picks)
      const page = await discoverApi(mediaType, params, { page: 1 })
      return { mediaType, results: (page.results ?? []).slice(0, 12) }
    },
  })

  const toggle = (pick: TastePick) => {
    setSaved(false)
    setPicked((current) => {
      const without = current.filter((item) => item.id !== pick.id)
      if (without.length !== current.length) return without
      if (current.length >= TASTE_MAX) return current
      return [...current, pick]
    })
  }

  const saveAll = () => {
    const results = suggest.data?.results ?? []
    const existing = new Set(watchlist.map((item) => item.id))
    const additions: WatchedItem[] = results
      .filter((item) => !existing.has(item.id))
      .map((item) =>
        buildWatchedItem(item as Parameters<typeof buildWatchedItem>[0])
      )

    if (additions.length === 0) {
      toast('All of these are already on your watchlist.')
      return
    }
    setWatchlist([...additions, ...watchlist])
    setSaved(true)
    toast(`${additions.length} saved to your watchlist.`)
  }

  const results = suggest.data?.results ?? []
  const mediaType = suggest.data?.mediaType ?? 'movie'

  return (
    <div className="space-y-10">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {candidates.map((candidate) => {
          const on = picked.some((item) => item.id === candidate.id)
          return (
            <li key={`${candidate.type}-${candidate.id}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(candidate)}
                className={`group relative block w-full overflow-hidden rounded-lg border-2 transition-all ${
                  on
                    ? 'border-primary scale-[0.97]'
                    : 'border-transparent hover:-translate-y-1'
                }`}
              >
                {candidate.poster_path ? (
                  <BlurredImage
                    src={getPosterImageURL(candidate.poster_path)}
                    alt={candidate.title}
                    width={500}
                    height={750}
                    quality={POSTER_QUALITY}
                    sizes="(min-width: 1024px) 15vw, 30vw"
                    className="aspect-2/3 w-full object-cover"
                  />
                ) : (
                  <span className="bg-muted flex aspect-2/3 w-full items-center justify-center p-2 text-center text-xs">
                    {candidate.title}
                  </span>
                )}
                {on && (
                  <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex size-6 items-center justify-center rounded-full">
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="bg-background/85 sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-lg border p-4 backdrop-blur">
        <p className="text-sm font-medium">{tastePrompt(picked.length)}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {picked.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setPicked([])
                suggest.reset()
              }}
            >
              <RotateCcw className="mr-2 size-4" />
              Start over
            </Button>
          )}
          <Button
            disabled={picked.length < TASTE_MIN || suggest.isPending}
            onClick={() => suggest.mutate(picked)}
          >
            {suggest.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Show me what to watch
          </Button>
        </div>
      </div>

      {suggest.isError && (
        <p className="text-muted-foreground text-sm">
          That did not work. Try again — nothing was lost.
        </p>
      )}

      {results.length > 0 && (
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Because of what you picked
            </h2>
            <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
              Worked out from the genres your picks have in common. Nothing was
              recorded anywhere — this is the same catalogue everyone browses,
              asked a better question.
            </p>
          </div>

          {/* The same Card the homepage rails and every browse grid use, so a
              recommendation here behaves exactly like one anywhere else: hover
              details, the watched tick, the score chip and the prefetch on
              intent. A hand-rolled poster grid here would have been a fourth
              way of drawing the same thing. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
            {results.map((item) => (
              <Card
                key={item.id}
                item={item as MediaType}
                itemType={mediaType}
                isTruncateOverview={false}
              />
            ))}
          </div>

          <div className="border-primary/25 from-primary/10 flex flex-col gap-4 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground max-w-[52ch] text-sm leading-relaxed">
              {signedIn
                ? 'Save them and they follow you to every device you sign in on.'
                : 'Save them to this browser now, for free. Signing in with Google — also free — is what keeps them when this browser is cleared or swapped.'}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button onClick={saveAll} disabled={saved}>
                {saved ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <ArrowRight className="mr-2 size-4" />
                )}
                {saved ? 'On your watchlist' : 'Save all to my watchlist'}
              </Button>
              {!signedIn && (
                <Link
                  href="/account"
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Sign in to keep them
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
