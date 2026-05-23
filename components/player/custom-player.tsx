'use client'

import React, { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Icons } from '@/components/icons'
import { SubtitleSelector } from './subtitle-selector'
import { cn } from '@/lib/utils'

interface Subtitle {
  code: string
  name: string
  url: string
}

interface CustomPlayerProps {
  videoUrl: string
  subtitles?: Subtitle[]
}

export function CustomPlayer({ videoUrl, subtitles = [] }: CustomPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSubtitleOpen, setIsSubtitleOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState<string>('')
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null

    if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
      hls = new Hls()
      hls.loadSource(videoUrl)
      hls.attachMedia(video)
      setHlsInstance(hls)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = videoUrl
    } else {
      // Fallback for mp4 or other native formats
      video.src = videoUrl
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [videoUrl])

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play()
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        setIsPlaying(false)
      }
    }
  }

  const handleLanguageChange = (code: string) => {
    setCurrentLang(code)
    setIsSubtitleOpen(false)
    const video = videoRef.current
    if (!video) return

    // Find the track and enable it
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i]
      if (track.language === code) {
        track.mode = 'showing'
      } else {
        track.mode = 'hidden'
      }
    }
  }

  // Turn off subtitles if none selected initially
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!currentLang) {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'hidden'
      }
    }
  }, [currentLang, subtitles])

  return (
    <div className="relative group w-full h-full bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        {subtitles.map((sub) => (
          <track
            key={sub.code}
            kind="subtitles"
            srcLang={sub.code}
            label={sub.name}
            src={sub.url}
          />
        ))}
      </video>

      {/* Control Bar Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="text-white hover:text-blue-500 transition-colors"
          >
            {isPlaying ? (
              <Icons.pause className="w-6 h-6" />
            ) : (
              <Icons.playIcon className="w-6 h-6" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 relative">
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsSubtitleOpen(!isSubtitleOpen)
                }}
                className={cn(
                  'text-white hover:text-blue-500 transition-colors font-semibold',
                  currentLang ? 'text-blue-500' : ''
                )}
                title="Subtitles"
              >
                CC
              </button>
              <SubtitleSelector
                languages={subtitles}
                currentLang={currentLang}
                onLanguageChange={handleLanguageChange}
                isOpen={isSubtitleOpen}
                onClose={() => setIsSubtitleOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
