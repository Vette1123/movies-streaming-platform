// Shared PNG squeezer for the pre-rendered assets in public/.
//
// Satori/resvg emit honest but fat 32-bit PNGs — the OG image came out over
// 200KB and the 512px icon over 100KB. These files are committed, shipped as
// Cloudflare static assets and fetched by every social scraper and install
// prompt, so the bytes are worth chasing once at build time.
//
// Two candidates are tried and the smaller one wins:
//   - lossless recompression at max zlib effort
//   - an 8-bit palette quantization
// Palette usually wins by a wide margin on this artwork (a two-colour gradient
// plus one glyph), but it is quantization, so it is never assumed — on an
// image with enough distinct colours the palette version can be the larger of
// the two, and banding is the thing to watch for on the big gradients.

import sharp from 'sharp'

/**
 * @param {Buffer} input  raw PNG bytes
 * @returns {Promise<{buf: Buffer, note: string}>}
 */
export async function optimizePng(input) {
  const [lossless, palette] = await Promise.all([
    sharp(input)
      .png({ compressionLevel: 9, effort: 10, palette: false })
      .toBuffer(),
    sharp(input)
      .png({
        compressionLevel: 9,
        effort: 10,
        palette: true,
        quality: 100,
        dither: 1,
      })
      .toBuffer(),
  ])

  const winner = palette.length < lossless.length ? palette : lossless
  const kind = palette.length < lossless.length ? 'palette' : 'lossless'
  const saved = Math.round((1 - winner.length / input.length) * 100)

  return { buf: winner, note: `${kind}, -${saved}%` }
}
