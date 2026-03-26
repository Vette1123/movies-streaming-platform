'use client'

import React, { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={scrollUp}
          className="fixed bottom-[4.5rem] right-6 z-50 flex size-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition-colors hover:bg-white/20 lg:bottom-6"
          aria-label="Scroll to top"
        >
          <ChevronUp className="size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
