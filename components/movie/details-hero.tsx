'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { MovieDetails } from '@/types/movie-details'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { HeroImage } from '@/components/header/hero-image'
import { Icons } from '@/components/icons'

export const DetailsHero = ({ movie }: { movie: MovieDetails }) => {
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const playVideo = () => {
    if (iframeRef.current) {
      iframeRef.current.src = `${STREAMING_MOVIES_API_URL}/movie/${movie?.id}?autoplay=1`
      setIsIframeShown(true)
    }
  }
  return (
    <section className="relative isolate h-[500px] overflow-hidden lg:h-screen">
      <HeroImage movie={movie} />
      <div className="container relative z-50 h-full max-w-screen-2xl">
        <div className="flex h-full items-center justify-center">
          <AnimatePresence>
            {!isIframeShown && (
              <motion.div
                transition={{ type: 'spring', stiffness: 500 }}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -150 }}
                className={cn({
                  hidden: isIframeShown,
                })}
              >
                <Icons.playIcon
                  onClick={playVideo}
                  fill="#a5b4fc"
                  className={cn('h-24 w-24 cursor-pointer text-primary')}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <iframe
            className={cn('h-full w-full py-20', {
              hidden: !isIframeShown,
            })}
            allowFullScreen
            ref={iframeRef}
            content="noindex,nofollow"
            src=""
            autoSave="true"
            about={movie.title}
            allow="autoplay *; encrypted-media *; fullscreen *; geolocation *; midi *;  accelerometer *; gyroscope *; encrypted-media *;"
          ></iframe>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
}
