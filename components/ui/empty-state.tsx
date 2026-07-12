'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateAction {
  href: string
  label: string
  icon?: LucideIcon
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  className?: string
}

// A ghost poster echoes the real WatchedItemCard's 2:3 shape, so the empty
// state previews the grid that will eventually fill this space.
const PosterGhost = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn(
      'from-muted/90 to-muted/20 aspect-2/3 w-16 rounded-lg border border-white/10 bg-linear-to-b shadow-lg sm:w-20',
      className
    )}
  />
)

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const reduce = useReducedMotion()

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: 0.04 },
    },
  }
  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
    },
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center px-6 text-center',
        className
      )}
    >
      {/* Signature: a fanned trio of ghost posters with a floating medallion. */}
      <motion.div
        variants={item}
        className="relative mb-8 flex items-end justify-center"
      >
        <div
          aria-hidden
          className="bg-primary/20 absolute top-1/2 left-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        />
        <PosterGhost className="-mr-6 translate-y-3 -rotate-12 opacity-50" />
        <PosterGhost className="relative z-10 scale-105 opacity-95" />
        <PosterGhost className="-ml-6 translate-y-3 rotate-12 opacity-50" />
        <div className="bg-background/70 ring-primary/20 absolute top-1/2 left-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-cyan-300/30 text-cyan-300 shadow-xl ring-1 backdrop-blur-md">
          <Icon className="size-7" aria-hidden />
        </div>
      </motion.div>

      <motion.h2
        variants={item}
        className="text-foreground text-xl font-semibold text-balance sm:text-2xl"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={item}
        className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-pretty sm:text-base"
      >
        {description}
      </motion.p>

      {(primaryAction || secondaryAction) && (
        <motion.div
          variants={item}
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
        >
          {primaryAction && (
            <Button
              asChild
              size="lg"
              className="gap-2 rounded-full transition hover:scale-105 active:scale-95"
            >
              <Link href={primaryAction.href}>
                {primaryAction.icon && (
                  <primaryAction.icon className="size-4" aria-hidden />
                )}
                {primaryAction.label}
              </Link>
            </Button>
          )}
          {secondaryAction && (
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground gap-2 rounded-full"
            >
              <Link href={secondaryAction.href}>
                {secondaryAction.icon && (
                  <secondaryAction.icon className="size-4" aria-hidden />
                )}
                {secondaryAction.label}
              </Link>
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
