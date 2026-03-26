'use client'

import React, { forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import posthog from 'posthog-js'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { cn } from '@/lib/utils'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'
import { ShareButton } from '@/components/share-button'
import { TrailerButton } from '@/components/trailer-button'

export const DetailsHero = forwardRef<
  HTMLIFrameElement,
  {
    movie?: MovieDetails
    series?: SeriesDetails
    isIframeShown: boolean
    playVideo: () => void
    trailerKey?: string
  }
>(({ movie, isIframeShown, playVideo, series, trailerKey }, ref) => {
  const media = (movie || series) as MovieDetails & SeriesDetails
  const title = media?.title || media?.name
  const router = useRouter()

  return (
    <section className="relative isolate h-[500px] overflow-hidden lg:h-[80dvh]">
      <HeroImage movie={media} />
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute left-4 top-20 z-50 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70 lg:left-8 lg:top-24"
        aria-label="Go back"
      >
        <ChevronLeft className="size-4" />
        Back
      </button>
      <div className="container relative z-50 h-full max-w-(--breakpoint-2xl)">
        <div className="flex h-full items-center justify-center">
          <AnimatePresence>
            {!isIframeShown && (
              <motion.div
                transition={{ type: 'spring', stiffness: 500 }}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -150 }}
                className="flex flex-col items-center gap-4"
              >
                <PlayButton
                    onClick={() => {
                      posthog.capture('watch_started', {
                        media_id: media?.id,
                        media_title: title,
                        media_type: movie ? 'movie' : 'tv',
                      })
                      playVideo()
                    }}
                    media={media}
                  />
                <div className="flex gap-3">
                  {trailerKey && <TrailerButton trailerKey={trailerKey} />}
                  <ShareButton title={title} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <iframe
            className={cn('size-full py-20', {
              hidden: !isIframeShown,
            })}
            allowFullScreen
            ref={ref}
            autoFocus
            content="noindex,nofollow"
            autoSave={title.toLowerCase().trim()}
            id={title}
            name={title}
            title={title}
            about={media?.overview}
            key={media?.id}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          ></iframe>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
})

DetailsHero.displayName = 'DetailsHero'
