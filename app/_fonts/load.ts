// Inter glyph subsets bundled as base64 so OG / icon ImageResponse renders
// don't make any network calls. Cloudflare Workers had ~50% of /opengraph-image
// requests returning 503 (error 1102, CPU time exceeded) because fetching
// Google Fonts CSS + woff2 on every render + Satori rasterization was tipping
// over the worker CPU budget. WhatsApp scrapes once with no retry, so a single
// 503 meant no preview when sharing reely.space.
//
// To regenerate after editing the OG_INTER_GLYPHS_* strings below:
//   pnpm fonts:og

import { INTER_700_TTF_B64 } from './inter-700'
import { INTER_900_TTF_B64 } from './inter-900'

export const OG_INTER_GLYPHS_900 = 'Reely R'
export const OG_INTER_GLYPHS_700 =
  'Watch movies & TV shows. Free.Discover, track, and stream thousands of trending titles — no signup, no paywall.FREE TO STREAMreely.spaceMOVIESTV SHOWSTRENDINGMade bymohamedgado.com'

function decodeBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

const INTER_700 = decodeBase64(INTER_700_TTF_B64)
const INTER_900 = decodeBase64(INTER_900_TTF_B64)

export async function loadInter(
  weight: 700 | 900,
  _text: string
): Promise<ArrayBuffer> {
  return weight === 900 ? INTER_900 : INTER_700
}
