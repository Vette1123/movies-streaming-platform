'use client'

import * as React from 'react'
import Link from 'next/link'

import { Mood, moodById, MOODS, moodToFilters } from '@/lib/moods'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { DiscoverGrid } from '@/components/media/discover-grid'

// The mood picker compiles a feeling down to the same discover call the genre
// pages make, so it renders through the same grid — see DiscoverGrid.

type MoodMedia = 'movie' | 'tv'

const MoodResults = ({
  mood,
  mediaType,
}: {
  mood: Mood
  mediaType: MoodMedia
}) => (
  <DiscoverGrid
    mediaType={mediaType}
    filters={moodToFilters(mood, mediaType)}
    cacheKey={['mood', mood.id, mediaType]}
    emptyMessage="Nothing matched this mood — try another."
  />
)

const MEDIA_TABS: { id: MoodMedia; label: string }[] = [
  { id: 'movie', label: 'Films' },
  { id: 'tv', label: 'Series' },
]

export default function MoodPage() {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [mediaType, setMediaType] = React.useState<MoodMedia>('movie')
  const mood = moodById(activeId)
  const resultsRef = React.useRef<HTMLDivElement>(null)

  // The pick lives in the URL, so "scare me, series" is a link you can send and
  // a reload you can survive. Written with history.replaceState and read from
  // window.location on mount rather than through nuqs: a useSearchParams read
  // bails the whole route to client-side rendering under `output: 'export'`,
  // and this page's heading is the only thing a crawler gets.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('mood')
    // After mount on purpose: the prerendered HTML knows no query string, so
    // reading it during render would hydrate into markup the server never
    // produced.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (moodById(fromUrl)) setActiveId(fromUrl)
    if (params.get('type') === 'tv') setMediaType('tv')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const syncUrl = (id: string | null, type: MoodMedia) => {
    const params = new URLSearchParams()
    if (id) params.set('mood', id)
    if (id && type === 'tv') params.set('type', 'tv')
    const query = params.toString()
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname
    )
  }

  // On a phone the eight mood cards fill the screen, so a pick used to change
  // something entirely below the fold and read as "nothing happened".
  const pick = (id: string) => {
    const next = id === activeId ? null : id
    setActiveId(next)
    syncUrl(next, mediaType)
    if (next) {
      window.setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
        60
      )
    }
  }

  const selectMedia = (type: MoodMedia) => {
    setMediaType(type)
    syncUrl(activeId, type)
  }

  return (
    <section className="container min-h-svh py-20 lg:py-32">
      <h1 className="text-2xl font-bold lg:text-3xl">
        What are you in the mood for?
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Skip the scrolling. Pick the feeling, get a stack tuned for it. Every
        pick is rated 6.5+ by people who watched it.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`mood-${entry.id}`}
            onClick={() => pick(entry.id)}
            aria-pressed={entry.id === activeId}
            className={cn(
              // flex-col, because a <button> vertically CENTRES its content
              // when the grid stretches it taller than that content - which is
              // why the titles in one row did not line up with each other.
              'flex flex-col items-start rounded-xl border p-4 text-left transition',
              entry.id === activeId
                ? 'border-primary bg-primary/10'
                : 'hover:border-foreground/30'
            )}
          >
            <span className="text-2xl">{entry.emoji}</span>
            <span className="mt-1 block font-semibold">{entry.label}</span>
            <span className="text-muted-foreground block text-xs">
              {entry.blurb}
            </span>
          </button>
        ))}
      </div>

      <div ref={resultsRef} className="mt-10 scroll-mt-24">
        {mood ? (
          <>
            {/* A mood is a feeling, not a format — "make me laugh" is as much a
                sitcom as a comedy film. The genre ids differ per type, which is
                why the mood carries both sets. */}
            <div className="mb-5 inline-flex rounded-full border p-1">
              {MEDIA_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`mood-media-${tab.id}`}
                  onClick={() => selectMedia(tab.id)}
                  aria-pressed={mediaType === tab.id}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition',
                    mediaType === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <MoodResults mood={mood} mediaType={mediaType} />
          </>
        ) : (
          <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            Tap a mood above and the stack appears here.
            <div className="mt-4">
              <Link href="/reels" className={buttonVariants({ size: 'sm' })}>
                Or swipe trailers in Reels
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
