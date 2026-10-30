'use client'

import React from 'react'
import Image, { ImageProps } from 'next/image'

import {
  demoteFromPrimary,
  getNextImageFallback,
  isPrimaryImageHostDown,
  markPrimaryImageHostDown,
  subscribePrimaryImageHost,
} from '@/lib/tmdbConfig'
import { cn } from '@/lib/utils'

interface BlurImageProps extends ImageProps {
  className: string
  intro?: boolean
}

// Every image on this site used to come through at q-82, which is a default
// nobody chose — and measured against the actual artwork it is most of the
// payload. On a cold 4x-throttled mobile load the homepage pulled 2.0 MB of
// images against 332 KB of (brotli'd) JS, so this is THE lever.
//
// Measured on the real files, same URL, WebP:
//   backdrop w1200  q82 62.5KB -> q65 33.1KB   (-47%)
//   poster   w500   q82 112KB  -> q70 86KB     (-24%)
//
// The two numbers differ because the two jobs differ. A backdrop is a
// full-bleed photo that spends its life under a scrim, behind text, often
// mid-ken-burns and mid-swipe — nobody inspects it, and 65 is invisible there.
// A poster IS the content: it is small, dense, carries a legible title
// treatment, and is what someone is actually looking at when they choose what to
// watch, so it only gives up the top of the range where the returns are worst.
//
// Set here rather than at the call sites so a new poster somewhere can't quietly
// reintroduce the default. Any caller can still pass its own `quality` and win.
export const HERO_QUALITY = 65
// Exported because the `intro` branch (blur-up reveal) defaults to the BACKDROP
// number, and two posters render through it — the big details poster and the
// cast portraits. They are posters wearing the hero's reveal, so they name the
// poster quality explicitly rather than inheriting 65 by accident.
export const POSTER_QUALITY = 70

// Stable server snapshot for useSyncExternalStore — an inline `() => false`
// would be a new function every render.
const returnFalse = () => false
const returnTrue = () => true
const subscribeNever = () => () => {}

// Dark backing for the two `fill` branches, so a box that has reserved its space
// isn't a transparent hole in the page until the image paints. It fills the same
// `relative` parent the `fill` image positions against and sits behind it by DOM
// order; the image is opaque and covers it the instant it has pixels, so no
// opacity, no transition, no runtime cost. The intrinsic branch gets the same
// thing for free from its own wrapper's `bg-slate-900`.
const ImageBacking = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 bg-slate-900"
  />
)

// Memoised. Every prop this takes is a primitive (src, alt, className, sizes,
// width/height, priority…), so a shallow compare is exact rather than a
// heuristic — and the two callers that re-render most are the ones that hurt:
// the hero carousel re-renders a slide whenever it becomes active, and the rails
// re-render their rows on every infinite-scroll page. Both handed this component
// byte-identical props and got a full next/image reconcile for it.
//
// Memo cannot make this stale: the fallback-chain state below is driven by the
// `src` prop through a render-time snapshot, so a changed src always re-renders.
export const BlurredImage = React.memo(function BlurredImage({
  src,
  alt,
  className,
  intro = false,
  ...restProps
}: BlurImageProps) {
  // An <img> is draggable by default, so a press-and-drag anywhere on a poster
  // starts a NATIVE HTML5 image drag: Chrome paints a bitmap ghost of the image
  // with square corners and a pale 1px frame — ignoring the wrapper's rounded
  // corners — and that drag loop swallows the pointer, so the hero carousel's
  // own drag-to-advance dies mid-gesture. Nothing in this app ever wants an
  // image dropped somewhere, so opt every one of them out at the source.
  // Spread first: a caller can still pass draggable explicitly and win.
  const props = { draggable: false, ...restProps }
  const [isLoading, setLoading] = React.useState(true)
  // Render from this src so we can walk the fallback chain if a URL fails:
  // wsrv.nl -> TMDB origin. Each onError advances one stage. Kept in
  // sync when `src` changes so recycled instances in lists don't show a stale
  // fallback.
  const [imgSrc, setImgSrc] = React.useState(src)
  const [srcSnapshot, setSrcSnapshot] = React.useState(src)

  // Adjust during render, not in an effect. React re-runs this component before
  // touching the DOM, so a recycled list instance never paints one frame of the
  // PREVIOUS poster the way the old effect did (it fired after commit). This is
  // React's documented "adjusting state when a prop changes" pattern — setting
  // state during render of the same component, guarded so it can't loop.
  if (src !== srcSnapshot) {
    setSrcSnapshot(src)
    setImgSrc(src)
  }

  // Once enough images have proved the primary host is down, skip stage 0
  // instead of making each new <img> rediscover it with a request that cannot
  // succeed. Derived at render rather than written into `imgSrc`, so the chain
  // position this component actually walks stays untouched. Server snapshot is
  // always `false` — the prerendered HTML names wsrv, and claiming otherwise
  // during hydration would be a mismatch.
  const primaryDown = React.useSyncExternalStore(
    subscribePrimaryImageHost,
    isPrimaryImageHostDown,
    returnFalse
  )
  // `isLoading` is the guard that matters: an image that has ALREADY painted is
  // left exactly where it is. Demoting those was measured to be the whole
  // problem — one stray error moved 17 of 20 homepage images off a host that
  // had just served them, throwing away 17 warm HTTP cache entries and replaying
  // 17 blur-ups against a cold host. The breaker exists to stop images that have
  // not loaded yet from queueing behind a dead host, and that is all it should do.
  const effectiveSrc =
    primaryDown && isLoading ? demoteFromPrimary(imgSrc) : imgSrc

  const handleError = React.useCallback(() => {
    markPrimaryImageHostDown(effectiveSrc)
    const fallback = getNextImageFallback(effectiveSrc)
    if (fallback && fallback !== effectiveSrc) setImgSrc(fallback)
  }, [effectiveSrc])

  // next/image forwards `ref` to the underlying <img> (Next 16). A callback ref
  // runs synchronously during commit — before the browser paints — so when the
  // image is ALREADY complete at mount (cache hit, or decoded fast enough that
  // it finished before first paint) we flip to "loaded" instantly and no reveal
  // animation is ever painted. This is what keeps a cached list-scroll from
  // flashing. The reveal below only plays for genuine network loads, where it
  // sits behind real fetch time and reads as a smooth fade.
  const imgRef = React.useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoading(false)
  }, [])

  // Intrinsic (width+height) usage — poster cards in grids and rails. Reserve
  // the exact box with `aspect-ratio` BEFORE the image loads (no CLS / no
  // neighbour overflow: `w-full` shrinks to the grid track / rail item instead
  // of the old `w-fit`, which forced the <img>'s native 250px). The reveal is a
  // dark-placeholder crossfade layered ON TOP of the image, so it never touches
  // the image's own `transition-transform` hover-scale — the previous approach
  // toggled `blur-lg`→`blur-0` on an element whose transition-property was only
  // `transform`, so the blur snapped off with no easing (the "flash").
  const hasIntrinsic =
    typeof props.width === 'number' && typeof props.height === 'number'

  // True for the server render and the hydration pass over it, false for
  // anything mounted on the client afterwards (a navigation, a remount).
  const fromServer = React.useSyncExternalStore(
    subscribeNever,
    returnFalse,
    returnTrue
  )

  if (intro) {
    // Hero / large single posters. These were a blur-up: drawn at blur-lg
    // until onLoad, then eased sharp over 700ms. A cold detail page measured
    // dark at 1.27s, a smear at 1.57s and the picture at 2.2s — three looks
    // before the page settled, and the blur was the image ALREADY THERE being
    // held back. Now a fade from the dark backing, and only where nothing was
    // drawn yet: in server HTML the picture is never hidden, because hiding it
    // until hydration would keep the LCP image off screen until the scripts
    // ran. The hydration pass renders it visible to match; the client pass
    // after it, if the image is still on its way, takes it to 0 and back.
    const veiled = isLoading && !fromServer
    const blurClassName = cn(
      className,
      'transition-opacity duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
      veiled && 'opacity-0'
    )
    return (
      <>
        {props.fill ? <ImageBacking /> : null}
        <Image
          quality={HERO_QUALITY}
          {...props}
          ref={imgRef}
          alt={alt}
          src={effectiveSrc}
          className={blurClassName}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      </>
    )
  }

  if (hasIntrinsic) {
    // Reserve the exact box via aspect-ratio, then let the image `fill` it. Using
    // `fill` (not the width/height props as CSS-sized) is the canonical next/image
    // pattern for a responsive box and avoids the "width/height modified" distortion
    // warning. width/height are stripped so `fill` isn't passed alongside them.
    const { width, height, ...rest } = props
    // `fill` with no `sizes` makes next/image emit `sizes="100vw"`, so the
    // browser picks a candidate for the whole viewport width — measured on the
    // homepage as 64 of 70 images fetching the 500px variant into a 250px box,
    // and it gets worse the bigger the screen (and on a dpr-3 phone, where
    // 100vw resolves to ~1180px of intent for a ~150px poster).
    //
    // The box is `w-full` of a rail item / grid track that is sized around the
    // intrinsic width, so declaring that width is honest: the browser still
    // multiplies by DPR, it just stops budgeting for a full-bleed image. Under
    // 640px the grid/rail puts roughly two across, hence 50vw there. Callers
    // with a genuinely different layout can pass their own `sizes` and win.
    const sizes = rest.sizes ?? `(max-width: 640px) 50vw, ${width}px`
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg bg-slate-900"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {/* Blur-up "glow" reveal: the poster blooms in from a soft blur + slight
            zoom as it decodes, then settles. The transition names BOTH `transform`
            and `filter`, so the blur EASES off instead of snapping — that snap
            (transition-property was transform-only) is why the blur-up was dropped
            in 9c94d1d. Same 500ms/ease-out as the hover zoom, so hover feel is
            unchanged. The wrapper's bg-slate-900 backs the reserved box, so there's
            no blank before the first pixels paint, and the aspect-ratio box means
            zero CLS. */}
        <Image
          quality={POSTER_QUALITY}
          {...rest}
          ref={imgRef}
          alt={alt}
          src={effectiveSrc}
          fill
          sizes={sizes}
          className={cn(
            className,
            'object-cover transition-[transform,filter] duration-500 ease-out',
            isLoading ? 'scale-[1.03] blur-lg' : 'blur-0 scale-100'
          )}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      </div>
    )
  }

  // Non-intro `fill` usage (e.g. the collection banner, a person portrait): the
  // caller owns the `relative` box, so the picture just fills it. The `w-fit
  // rounded-lg bg-slate-900` div that used to sit here painted nothing — its
  // only child was absolutely positioned, so it measured 0x0 — and it is what
  // put a static parent between the box and the image.
  const blurClassName = cn(className, 'duration-700 ease-in-out', {
    'blur-lg': isLoading,
    'blur-0': !isLoading,
  })
  return (
    <>
      {/* The person grids and the collection banner land here. Their boxes have
          a reserved aspect ratio and nothing behind it, so before the portrait
          painted you saw the page's own background through a rounded rectangle
          — a hole, not a placeholder. */}
      <ImageBacking />
      <Image
        quality={HERO_QUALITY}
        {...props}
        ref={imgRef}
        alt={alt}
        src={effectiveSrc}
        className={blurClassName}
        onLoad={() => setLoading(false)}
        onError={handleError}
      />
    </>
  )
})
