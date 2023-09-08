'use client'

import '@splidejs/react-splide/css'

import React from 'react'
import Link from 'next/link'
import { Splide, SplideSlide } from '@splidejs/react-splide'
import { motion } from 'framer-motion'

import { Movie } from '@/types/movie-result'
import {
  CHANGE_COLOR_VARIANT,
  HIDDEN_TEXT_ARROW_VARIANT,
  HIDDEN_TEXT_VARIANT,
} from '@/lib/motion-variants'
import { Card } from '@/components/card'
import { Icons } from '@/components/icons'

interface ListProps {
  title: string
  href: string
  items: Movie[]
}

export const List = ({ title, href, items }: ListProps) => {
  return (
    <section className="container mb-10 pb-16 pt-12">
      <Link href="/movies">
        <motion.div
          className="mb-4 flex w-fit items-center gap-2"
          initial="rest"
          whileHover="hover"
          animate="rest"
        >
          <motion.h2
            className="text-2xl font-bold transition"
            variants={CHANGE_COLOR_VARIANT}
          >
            {title}
          </motion.h2>
          <motion.div
            className="text-base text-cyan-200"
            variants={HIDDEN_TEXT_VARIANT}
          >
            <span className="font-sans text-sm font-medium">Explore All</span>
          </motion.div>
          <motion.span
            variants={HIDDEN_TEXT_ARROW_VARIANT}
            className="text-base text-cyan-200"
          >
            <Icons.arrowRight className="ml-1 inline-block h-4 w-4" />
          </motion.span>
        </motion.div>
      </Link>
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
            <Card item={item} />
          </SplideSlide>
        ))}
      </Splide>
    </section>
  )
}
