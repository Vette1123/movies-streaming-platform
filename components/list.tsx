'use client'

import React from 'react'
import { Splide, SplideSlide } from '@splidejs/react-splide'

import { Card } from './card'
// Default theme
import '@splidejs/react-splide/css'

// or other themes

export const List = () => {
  return (
    <section className="container mb-10 py-12">
      <h3 className="mb-4 text-2xl font-bold">Trending Movies</h3>
      <Splide
        options={{
          perPage: 4,
          rewind: true,
          gap: '2rem',
        }}
      >
        {Array.from({ length: 30 }, (_, i) => (
          <SplideSlide key={i}>
            <Card />
          </SplideSlide>
        ))}
      </Splide>
    </section>
  )
}
