'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { SeriesDetails } from '@/types/series-details'
import { STREAMING_MOVIES_API_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'
import { useSearchQueryParams } from '@/hooks/use-search-params'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'

export const SeriesDetailsHero = ({ series }: { series: SeriesDetails }) => {
  const { episodeQueryINT, seasonQueryINT } = useSearchQueryParams()
  const [isIframeShown, setIsIframeShown] = React.useState(false)
  const isMounted = useMounted()
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  const autoplaySessionURL = `${STREAMING_MOVIES_API_URL}/tv/${series?.id}/${seasonQueryINT}/${episodeQueryINT}?autoplay=1`

  const playDefaultSeries = () => {
    if (iframeRef.current && !episodeQueryINT && !seasonQueryINT) {
      setIsIframeShown(true)
      iframeRef.current.src = `${STREAMING_MOVIES_API_URL}/tv/${series?.id}?autoplay=1`
    }
    if (iframeRef.current && episodeQueryINT && seasonQueryINT) {
      setIsIframeShown(true)
      iframeRef.current.src = autoplaySessionURL
    }
  }

  React.useEffect(() => {
    if (iframeRef.current && episodeQueryINT && seasonQueryINT && isMounted) {
      setIsIframeShown(true)
      iframeRef.current.src = autoplaySessionURL
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeQueryINT, seasonQueryINT, series?.id])

  return (
    <section className="relative isolate h-[500px] overflow-hidden lg:h-[80dvh]">
      <HeroImage series={series} />
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
                <PlayButton onClick={playDefaultSeries} />
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
            autoSave="true"
            about={series.name}
            allow="autoplay *;"
          ></iframe>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-slate-900/50 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
}
