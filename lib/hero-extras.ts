import { ItemType } from '@/types/movie-result'

// Shared shape + key for the hero slide's trailer/logo enrichment. Lives in a
// neutral module (no 'use client', no service imports) so the server component
// that prebuilds the map and the client hook that reads it agree on the key —
// if these drifted, every seeded entry would silently miss and the homepage
// would quietly go back to fetching /api/hero-extras per slide.
export interface HeroExtras {
  trailerKey: string | null
  logoPath: string | null
  // False until the extras are known. Lets a slide distinguish "still fetching
  // the logo" from "resolved, no logo" — both leave logoPath null — so the title
  // can hold its fallback text back until the logo's fate is known. Anything
  // seeded from the server is ready by definition.
  ready: boolean
}

export type HeroExtrasSeed = Record<string, HeroExtras>

export const heroExtrasKey = (type: ItemType, id: number | string) =>
  `${type}:${id}`
