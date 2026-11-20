// Inter subsets bundled as base64 so the build-time card and icon renders
// (pnpm og:build, pnpm icons:build) make no network calls. Each file covers
// OG_GLYPHS in scripts/lib/og-glyphs.mjs, printable ASCII and a few symbols.
//
// To regenerate after changing that set: pnpm fonts:og

import { INTER_500_TTF_B64 } from './inter-500'
import { INTER_700_TTF_B64 } from './inter-700'
import { INTER_900_TTF_B64 } from './inter-900'

export type InterWeight = 500 | 700 | 900

function decodeBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

const INTER: Record<InterWeight, string> = {
  500: INTER_500_TTF_B64,
  700: INTER_700_TTF_B64,
  900: INTER_900_TTF_B64,
}

export function loadInter(weight: InterWeight): ArrayBuffer {
  return decodeBase64(INTER[weight])
}

/** Inter at every bundled weight, for `new ImageResponse(el, { fonts })`. */
export function interFonts() {
  return ([500, 700, 900] as const).map((weight) => ({
    name: 'Inter',
    data: loadInter(weight),
    weight,
    style: 'normal' as const,
  }))
}
