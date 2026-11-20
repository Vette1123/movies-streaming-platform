import { Easing } from 'remotion'

/** Reely's own palette (app/_og/source.tsx): navy-black, sky blue into indigo. */
export const C = {
  bg: '#020514',
  ink: '#f8fafc',
  dim: 'rgba(226,232,240,0.66)',
  faint: 'rgba(248,250,252,0.12)',
  sky: '#93c5fd',
  blue: '#60a5fa',
  deep: '#2563eb',
  indigo: '#818cf8',
  gold: '#fbbf24',
  green: '#22c55e',
}

export const GRADIENT =
  'linear-gradient(100deg, #93c5fd 0%, #60a5fa 45%, #818cf8 100%)'
export const FONT = "Inter, 'Segoe UI', sans-serif"

export const OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1)
export const OUT_QUART = Easing.bezier(0.25, 1, 0.5, 1)
export const IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)
