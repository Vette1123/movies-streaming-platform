// Pictures this tab has already shown, so a rebuilt page does not reveal them
// again.
//
// Back to a page is a client remount, and it made no image requests at all
// (measured on production): the flash was ours. `el.complete` cannot catch it,
// because a `loading="lazy"` image is not complete at mount however cached it
// is, so every remounted poster sat veiled and faded in. React's own commit is
// the only sync moment, so the answer has to be known before it.
//
// Holding an Image keeps the bytes in the browser's memory cache, which drops
// anything unreferenced on GC. Without it the picture falls back to the disk
// cache: no network, but at least one empty frame.
//
// ponytail: capped by count, not bytes. 300 posters is ~15MB at worst; a byte
// budget would need each response's size, which wsrv hides cross-origin.

type ImageSrc = unknown

export const MAX_SHOWN_IMAGES = 300

const shown = new Map<string, HTMLImageElement>()

export function imageShown(src: ImageSrc) {
  return typeof src === 'string' && shown.has(src)
}

export function rememberImage(src: ImageSrc, el: HTMLImageElement) {
  if (typeof src !== 'string') return
  const held = shown.get(src)
  shown.delete(src)
  if (held) {
    shown.set(src, held)
    return
  }
  const image = new Image()
  image.src = el.currentSrc || el.src
  shown.set(src, image)
  if (shown.size > MAX_SHOWN_IMAGES) {
    shown.delete(shown.keys().next().value as string)
  }
}

export function forgetShownImages() {
  shown.clear()
}

// `decoding="async"` is what paints a cached picture a frame after its page.
export const instantImageProps = (seen: boolean) =>
  seen ? ({ loading: 'eager', decoding: 'sync' } as const) : {}
