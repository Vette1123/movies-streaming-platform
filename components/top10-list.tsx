'use client'

import '@splidejs/react-splide/css'

import React from 'react'
import { Splide, SplideSlide } from '@splidejs/react-splide'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { Top10Card } from '@/components/top10-card'

interface Top10ListProps {
  title: string
  items: MediaType[]
  itemType?: ItemType
}

export function Top10List({ title, items, itemType = 'movie' }: Top10ListProps) {
  const top10 = items.slice(0, 10)
  if (!top10.length) return null

  return (
    <nav className="py-10">
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      <Splide
        options={{
          rewind: true,
          gap: '0.25rem',
          arrows: true,
          pagination: false,
          autoWidth: true,
        }}
      >
        {top10.map((item, index) => (
          <SplideSlide key={item.id}>
            <Top10Card item={item} rank={index + 1} itemType={itemType} />
          </SplideSlide>
        ))}
      </Splide>
    </nav>
  )
}
