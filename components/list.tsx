'use client'

import React from 'react'
import { Splide, SplideSlide } from '@splidejs/react-splide'

import '@splidejs/react-splide/css'

import { Card } from './card'

export const List = () => {
  return (
    <section className="container mb-10 py-12">
      <h3 className="mb-4 text-2xl font-bold">Trending Movies</h3>
      <Splide
        options={{
          rewind: true,
          gap: '1.5rem',
          arrows: true,
          pagination: false,
          autoWidth: true,
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <SplideSlide key={i}>
            <Card />
          </SplideSlide>
        ))}
      </Splide>
    </section>
  )
}
