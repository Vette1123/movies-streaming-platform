'use client'

import '@splidejs/react-splide/css'

import React from 'react'
import Link from 'next/link'
import { Splide, SplideSlide } from '@splidejs/react-splide'
import { motion } from 'framer-motion'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import {
  CHANGE_COLOR_VARIANT,
  HIDDEN_TEXT_ARROW_VARIANT,
  HIDDEN_TEXT_VARIANT,
} from '@/lib/motion-variants'
import { itemRedirect } from '@/lib/utils'
import { Card } from '@/components/card'
import { Icons } from '@/components/icons'

interface ListProps {
  title: string
  items: MediaType[]
  itemType?: ItemType
}

export const List = ({ title, items, itemType = 'movie' }: ListProps) => {
  return (
    <nav className="pb-10 pt-12 lg:pb-28">
      <motion.div
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="w-fit"
      >
        <Link
          href={itemRedirect(itemType)}
          className="mb-4 flex w-fit items-center gap-2"
        >
          <motion.h2
            className="text-2xl font-bold transition"
            variants={CHANGE_COLOR_VARIANT}
          >
            {title}
          </motion.h2>
          <motion.div
            className="mt-1 text-base text-cyan-200"
            variants={HIDDEN_TEXT_VARIANT}
          >
            <span className="font-sans text-sm font-medium">Explore All</span>
          </motion.div>
          <motion.span
            variants={HIDDEN_TEXT_ARROW_VARIANT}
            className="mt-1 text-base text-cyan-200"
          >
            <Icons.arrowRight className="ml-1 inline-block h-4 w-4" />
          </motion.span>
        </Link>
      </motion.div>
      {items.length === 0 && (
        <p className="text-lg text-gray-400">No items to show</p>
      )}
      {items.length > 0 && (
        <Splide
          options={{
            rewind: true,
            gap: '1.5rem',
            arrows: true,
            pagination: false,
            autoWidth: true,
          }}
        >
          {items.map((item) => (
            <SplideSlide key={item.id}>
              <Card item={item} itemType={itemType} />
            </SplideSlide>
          ))}
        </Splide>
      )}
    </nav>
  )
}
