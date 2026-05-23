import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { cn } from '@/lib/utils'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'
import { CustomPlayer } from '@/components/player/custom-player'

export const DetailsHero = ({
  movie,
  series,
  isVideoShown,
  playVideo,
  videoUrl,
}: {
  movie?: MovieDetails
  series?: SeriesDetails
  isVideoShown: boolean
  playVideo: () => void
  videoUrl?: string
}) => {
  const media = (movie || series) as MovieDetails & SeriesDetails
  const title = media?.title || media?.name

  // Mock subtitles for testing the UI
  const mockSubtitles = [
    { code: 'en', name: 'English', url: '#' },
    { code: 'vi', name: 'Vietnamese', url: '#' },
    { code: 'es', name: 'Spanish', url: '#' },
    { code: 'fr', name: 'French', url: '#' },
    { code: 'de', name: 'German', url: '#' },
    { code: 'ja', name: 'Japanese', url: '#' },
    { code: 'ko', name: 'Korean', url: '#' },
    { code: 'zh', name: 'Chinese', url: '#' },
  ]

  return (
    <section className="relative isolate h-[500px] overflow-hidden lg:h-[80dvh]">
      <HeroImage movie={media} />
      <div className="container relative z-50 h-full max-w-(--breakpoint-2xl)">
        <div className="flex h-full items-center justify-center">
          <AnimatePresence>
            {!isVideoShown && (
              <motion.div
                transition={{ type: 'spring', stiffness: 500 }}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -150 }}
                className={cn({
                  hidden: isVideoShown,
                })}
              >
                <PlayButton onClick={playVideo} media={media} />
              </motion.div>
            )}
          </AnimatePresence>
          {isVideoShown && videoUrl && (
            <div className="size-full py-20 bg-black">
              <CustomPlayer videoUrl={videoUrl} subtitles={mockSubtitles} />
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
}

DetailsHero.displayName = 'DetailsHero'
