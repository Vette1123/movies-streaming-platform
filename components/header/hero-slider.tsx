import React from 'react'
import { getLatestPopularMovies } from '@/services/movies'
import { Splide, SplideSlide } from '@splidejs/react-splide'

import { HeroImage } from '@/components/header/hero-image'
import { HeroSectionInfo } from '@/components/header/hero-info'

import '@splidejs/react-splide/css'

import Carousel from '../carousel'
import { Testing } from './testing'

export const HeroSlider = async () => {
  const latestMovies = await getLatestPopularMovies()

  return (
    <>
      <div className="relative overflow-hidden">
        <Testing latestMovies={latestMovies} />
        <div className="pointer-events-none absolute bottom-0 h-32 w-full bg-gradient-to-t from-black to-transparent" />
      </div>
    </>
  )
}
