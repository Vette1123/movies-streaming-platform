'use client'

import React from 'react'
import Image, { ImageProps } from 'next/image'

import { avifSrcSet } from '@/lib/image-loader'
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

// Every image on this site came through at ImageKit's q-82, which is a default
// nobody chose — and measured against the actual artwork it is most of the
// payload. On a cold 4x-throttled mobile load the homepage pulled 2.0 MB of
// images against 332 KB of (brotli'd) JS, so this is THE lever.
//
// Measured on the real files, same URL, same f-auto (ImageKit serves WebP):
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
const HERO_QUALITY = 65
// Exported because the `intro` branch (blur-up reveal) defaults to the BACKDROP
// number, and two posters render through it — the big details poster and the
// cast portraits. They are posters wearing the hero's reveal, so they name the
// poster quality explicitly rather than inheriting 65 by accident.
export const POSTER_QUALITY = 70

// Stable server snapshot for useSyncExternalStore — an inline `() => false`
// would be a new function every render.
const returnFalse = () => false

// Offers the browser AVIF before next/image's own <img>, and gets out of the way
// when it can't.
//
// A <source type="image/avif"> is read by the browser BEFORE it fetches
// anything: one that can't decode AVIF skips straight to the <img>, so this
// costs nothing and risks nothing — unlike baking f-avif into the URL, which
// would hand pre-2022 Safari bytes it can't read and drop it down the
// ImageKit -> wsrv -> TMDB error chain (a second request, on another host, after
// a visible failure). See lib/image-loader.ts for why f-auto won't do this
// itself and what it saves.
//
// Two deliberate abstentions:
//   - `priority` images. next/image emits <link rel="preload" imagesrcset> for
//     those, and that preload names the WEBP srcset. The document would then
//     preload one format and render another: the LCP image downloaded twice.
//     Nothing on the site passes `priority` any more for exactly that reason —
//     the heroes ask for `loading="eager"` + `fetchPriority="high"` instead,
//     which is the same fetch minus the preload tag, and measured strictly
//     faster because AVIF is worth more than the head start (see
//     components/header/hero-image.tsx). This guard stays for anything that
//     reintroduces `priority` later.
//   - Anything that has fallen off ImageKit. Once handleError has walked `src`
//     on to wsrv or the TMDB origin, an ImageKit AVIF URL is not a smaller copy
//     of that image, it is the URL that just failed.
//
// `quality` is the caller's own value when it passed one, and the branch
// default otherwise — resolved HERE rather than at the three call sites. The
// <img> has always honoured a caller's `quality` (it is spread after the
// default), but this <source> used to be handed the branch default directly, so
// a caller asking for something else got it in WebP and silently lost it in the
// AVIF copy that every modern browser actually takes.
function AvifSource({
  src,
  sizes,
  quality,
  fallbackQuality,
  priority,
}: {
  src: ImageProps['src']
  sizes?: string
  quality?: number | string
  fallbackQuality: number
  priority?: boolean
}) {
  if (priority || typeof src !== 'string') return null
  const srcSet = avifSrcSet(
    src,
    typeof quality === 'number' ? quality : fallbackQuality
  )
  if (!srcSet) return null
  return <source type="image/avif" srcSet={srcSet} sizes={sizes} />
}

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
  // ImageKit -> wsrv.nl -> TMDB origin. Each onError advances one stage. Kept in
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

  // Once enough images have proved the primary host is down (quota exhausted,
  // most likely — that fails every image for the rest of the month), skip stage
  // 0 instead of making each new <img> rediscover it with a request that cannot
  // succeed. Derived at render rather than written into `imgSrc`, so the chain
  // position this component actually walks stays untouched: an image already
  // down at wsrv or the origin is returned as-is. Server snapshot is always
  // `false` — the prerendered HTML names ImageKit, and claiming otherwise during
  // hydration would be a mismatch.
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

  if (intro) {
    // Hero / large single posters: deliberate blur-up reveal behind network time.
    const blurClassName = cn(className, 'duration-700 ease-in-out', {
      'blur-lg': isLoading,
      'blur-0': !isLoading,
    })
    return (
      <>
        {/* Dark backing so the hero isn't blank before the image has any pixels.
            The backdrop is an opaque photo that covers this the instant it paints,
            so no opacity/transition is needed here — a static fill is enough and
            costs nothing at runtime (no state coupling, no compositor work). It
            fills the same `relative` parent the `fill` image positions against and
            sits behind it by DOM order. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-slate-900"
        />
        <picture>
          <AvifSource
            src={effectiveSrc}
            sizes={props.sizes}
            quality={props.quality}
            fallbackQuality={HERO_QUALITY}
            priority={props.priority}
          />
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
        </picture>
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
        <picture>
          <AvifSource
            src={effectiveSrc}
            sizes={sizes}
            quality={rest.quality}
            fallbackQuality={POSTER_QUALITY}
            priority={rest.priority}
          />
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
        </picture>
      </div>
    )
  }

  // Non-intro `fill` usage (e.g. collection banner): the image is absolutely
  // positioned against an outer `relative` parent, so keep the light wrapper.
  const blurClassName = cn(className, 'duration-700 ease-in-out', {
    'blur-lg': isLoading,
    'blur-0': !isLoading,
  })
  return (
    <div className="w-fit overflow-hidden rounded-lg bg-slate-900">
      <picture>
        <AvifSource
          src={effectiveSrc}
          sizes={props.sizes}
          quality={props.quality}
          fallbackQuality={HERO_QUALITY}
          priority={props.priority}
        />
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
      </picture>
    </div>
  )
})
