'use client'

import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HeroImage } from '@/components/header/hero-image'

export const DetailsHero = ({ movie }: { movie: MovieDetails }) => {
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const playVideo = () => {
    if (iframeRef.current) {
      iframeRef.current.src = `https://vidsrc.to/embed/movie/${movie?.id}?autoplay=1`
      setIsIframeShown(true)
    }
  }
  return (
    <section className="relative isolate h-screen min-h-[500px] overflow-hidden">
      <HeroImage movie={movie} />
      <div className="container relative z-50 h-full max-w-screen-2xl">
        <div className="flex h-full items-center justify-center">
          <Button
            onClick={playVideo}
            className={cn({
              hidden: isIframeShown,
            })}
          >
            Play
          </Button>
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
