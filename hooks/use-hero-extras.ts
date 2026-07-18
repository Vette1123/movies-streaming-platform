'use client'

import { useEffect, useState } from 'react'

import { ItemType } from '@/types/movie-result'

export interface HeroExtras {
  trailerKey: string | null
  logoPath: string | null
}

// Module-level cache + in-flight map, shared across every slide instance. A
// single hero slide mounts several consumers of this hook (title logo, trailer
// button, hover preview); keying by `type:id` collapses them onto ONE network
// request, and remounting the same slide (autoplay looping past it again) is a
// cache hit with no fetch at all.
const cache = new Map<string, HeroExtras>()
const inFlight = new Map<string, Promise<HeroExtras>>()

const EMPTY: HeroExtras = { trailerKey: null, logoPath: null }

function load(key: string, type: ItemType, id: number): Promise<HeroExtras> {
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)

  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = fetch(`/api/hero-extras?type=${type}&id=${id}`)
    .then((res) => (res.ok ? res.json() : EMPTY))
    .then((data: HeroExtras) => {
      const value: HeroExtras = {
        trailerKey: data?.trailerKey ?? null,
        logoPath: data?.logoPath ?? null,
      }
      cache.set(key, value)
      inFlight.delete(key)
      return value
    })
    .catch(() => {
      inFlight.delete(key)
      return EMPTY
    })

  inFlight.set(key, promise)
  return promise
}

// `enabled` lets a slide defer the fetch until it is actually in the mounted
// window (so off-screen slides never enrich).
export function useHeroExtras(
  id: number | undefined,
  mediaType: ItemType,
  enabled = true
): HeroExtras {
  const key = id ? `${mediaType}:${id}` : ''
  const [extras, setExtras] = useState<HeroExtras>(
    () => (key && cache.get(key)) || EMPTY
  )

  useEffect(() => {
    if (!enabled || !id || !key) return
    let alive = true
    load(key, mediaType, id).then((value) => {
      if (alive) setExtras(value)
    })
    return () => {
      alive = false
    }
  }, [key, enabled, id, mediaType])

  return extras
}
