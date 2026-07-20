'use client'

import '@splidejs/react-splide/css'

import React from 'react'
import Link from 'next/link'
import { Splide, SplideSlide } from '@splidejs/react-splide'
import { motion } from 'framer-motion'
import { Clapperboard } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import {
  ACCENT_BAR_VARIANT,
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
    <nav className="py-6 sm:py-8 lg:py-10">
      <motion.div
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="w-fit"
      >
        <Link
          href={itemRedirect(itemType)}
          // Homepage stacks many carousels; each heading would viewport-prefetch a
          // section route. Every prefetch is an extra Worker RSC hit — skip it.
          prefetch={false}
          className="mb-4 flex w-fit items-center gap-2"
        >
          <motion.h2
            className="flex items-center gap-2.5 text-2xl font-bold tracking-tight transition"
            variants={CHANGE_COLOR_VARIANT}
          >
            <motion.span
              aria-hidden
              variants={ACCENT_BAR_VARIANT}
              className="h-5 w-[3px] origin-center rounded-full bg-gradient-to-b from-cyan-300 to-cyan-500 shadow-[0_0_8px_rgba(103,232,249,0.5)]"
            />
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
        <div
          role="status"
          className="text-muted-foreground border-border/60 flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm"
        >
          <Clapperboard className="size-4 shrink-0 opacity-70" />
          Nothing to show here yet — check back soon.
        </div>
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
