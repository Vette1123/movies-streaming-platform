'use client'

import { HeroExtrasSeed } from '@/lib/hero-extras'
import { seedHeroExtras } from '@/hooks/use-hero-extras'

/**
 * Hands the server-resolved hero extras to the client-side cache that
 * useHeroExtras reads (see services/hero-extras for why they're prebuilt).
 *
 * Seeds during render rather than in an effect, and is rendered BEFORE the
 * carousel: the hook reads the cache in its useState initializer, so an effect
 * would land one paint too late and every slide would fetch anyway — which is
 * the whole thing this avoids. Writing to a module Map during render is safe
 * here because seedHeroExtras is idempotent and never touches React state, so a
 * double render (StrictMode) changes nothing.
 */
export function HeroExtrasSeeder({ seed }: { seed: HeroExtrasSeed }) {
  seedHeroExtras(seed)
  return null
}
