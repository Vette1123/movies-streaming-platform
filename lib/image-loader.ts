// Custom next/image loader — the reason the site has responsive images at all.
//
// `output: 'export'` cannot use Next's built-in optimizer, and the config used
// to say `images.unoptimized: true`. That does not just skip resizing: it stops
// next/image emitting a `srcset` entirely, so every device downloaded and
// decoded whatever width the URL happened to name. The hero backdrop names
// w-2560, so a 393px phone was decoding a 2560x1440 image — three of them, since
// the carousel keeps a neighbour mounted either side. Measured as ~400ms frames
// during a swipe on a throttled phone profile.
//
// A custom loader is the supported escape hatch: next/image still generates the
// srcset and honours `sizes`, and this function decides what each width's URL
// looks like. ImageKit already resizes from the URL, so the width simply gets
// substituted into the transform it is asked for.
//
// Non-ImageKit URLs pass through untouched. That matters: BlurredImage walks a
// fallback chain (ImageKit -> wsrv.nl -> TMDB origin) on error, and the last two
// stages must not have ImageKit syntax spliced into them.

interface LoaderArgs {
  src: string
  width: number
  quality?: number
}

/** e.g. "/tr:w-2560,q-82,f-auto,pr-true/original/abc.jpg" */
const TRANSFORM = /\/tr:([^/]+)\//

/**
 * How many pixels wide the underlying TMDB file actually is.
 *
 * Requesting more than this from ImageKit upscales: more bytes, no more detail.
 * `original` has no fixed width; 2560 matches the widest the full-bleed hero
 * ever paints (a 2560px or retina panel) and is what the URL already asked for.
 */
function sourceWidth(src: string): number {
  const size = src.match(/\/(original|w(\d+))\//)
  if (!size) return 2560
  return size[2] ? Number(size[2]) : 2560
}

export default function imageKitLoader({ src, width, quality }: LoaderArgs) {
  const match = src.match(TRANSFORM)
  if (!match) return src

  // Never ask for more than the source has. Without this the thumbnail URLs
  // (whose size comes from the TMDB path segment, e.g. /w500) would be asked for
  // 3840 and ImageKit would happily upscale a 500px poster.
  const target = Math.min(width, sourceWidth(src))

  const params = match[1].split(',')
  let sawWidth = false

  const rewritten = params.map((param) => {
    if (param.startsWith('w-')) {
      sawWidth = true
      return `w-${target}`
    }
    if (quality && param.startsWith('q-')) return `q-${quality}`
    return param
  })

  // Thumbnail transforms carry no `w-` of their own, so add one. Posters in a
  // grid paint at ~200px CSS; serving them the full w500 source at every size
  // was the same waste as the hero, one order of magnitude smaller and forty
  // times per list page.
  if (!sawWidth) rewritten.unshift(`w-${target}`)

  return src.replace(TRANSFORM, `/tr:${rewritten.join(',')}/`)
}
