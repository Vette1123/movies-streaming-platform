import React, { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { cn } from '@/lib/utils'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'
import { SaveButton } from '@/components/save-button'
import { ShareButton } from '@/components/share-button'
import { TrailerDialog } from '@/components/trailer-dialog'

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
  const isMovie = !!movie

  // Bridge the blank gap between "Watch" click and the streaming iframe painting
  // its first frame: show a spinner while the iframe is shown but hasn't loaded.
  const [iframeLoaded, setIframeLoaded] = React.useState(false)
  React.useEffect(() => {
    if (isIframeShown) setIframeLoaded(false)
  }, [isIframeShown])

  return (
    <section className="relative isolate h-[500px] overflow-hidden lg:h-[80dvh]">
      <HeroImage movie={media} />
      <div className="relative z-50 container h-full max-w-(--breakpoint-2xl)">
        <div className="flex h-full items-center justify-center">
          <AnimatePresence>
            {!isIframeShown && (
              <motion.div
                transition={{ type: 'spring', stiffness: 500 }}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -150 }}
                className={cn('flex flex-col items-center gap-5', {
                  hidden: isIframeShown,
                })}
              >
                <PlayButton onClick={playVideo} media={media} />
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {trailerKey && (
                    <TrailerDialog
                      trailerKey={trailerKey}
                      mediaId={media?.id}
                      mediaType={isMovie ? 'movie' : 'tv'}
                      title={title}
                    />
                  )}
                  <SaveButton media={media} />
                  <ShareButton
                    title={title}
                    mediaId={media?.id}
                    mediaType={isMovie ? 'movie' : 'tv'}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isIframeShown && !iframeLoaded && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <Loader2 className="size-12 animate-spin text-white/80" />
            </div>
          )}
          <iframe
            className={cn('size-full py-20', {
              hidden: !isIframeShown,
            })}
            allowFullScreen
            ref={ref}
            autoFocus
            onLoad={() => setIframeLoaded(true)}
            content="noindex,nofollow"
            autoSave={title?.toLowerCase().trim()}
            id={title}
            name={title}
            title={title}
            about={media?.overview}
            key={media?.id}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          ></iframe>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-gradient-to-b from-slate-900/45 via-slate-900/10 to-slate-900/40 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
})

DetailsHero.displayName = 'DetailsHero'
