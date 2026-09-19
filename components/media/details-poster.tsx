import React from 'react'

import { getImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'

// The big poster beside the synopsis on a details page. Movies and series had
// byte-identical copies of this block, so it lives here once — a fix to either
// the box or the image can no longer land on one page and miss the other.
//
// Two things it does differently from the copies it replaces:
//
//   - `original`, not the w500 poster path. The box is 400 CSS px wide at lg,
//     which a dpr-2 laptop paints at 800 device px — the 500px source could
//     only be stretched to reach it. The loader still asks ImageKit for exactly
//     the width the layout needs (and `c-at_max` never enlarges), so a bigger
//     source costs nothing anywhere; it only stops the ceiling being 500.
//   - `quality={POSTER_QUALITY}`. Going through BlurredImage's `intro` branch
//     had it inherit the 65 tuned for backdrops — full-bleed photos that live
//     under a scrim behind text. This is the opposite: a small, dense image
//     with a title treatment, sitting still, that someone is looking straight
//     at.
//
// `sizes` names all three boxes the wrapper actually has (220 / 260 / 400),
// where the old string claimed 260 down to zero width.
const POSTER_SIZES =
  '(min-width: 1024px) 400px, (min-width: 640px) 260px, 220px'

/**
 * The breakpoint at which the poster stops being a centred block stacked above
 * the information and joins it on a single row.
 *
 * It lives here, beside the poster, because THREE class strings have to agree
 * about it and they were each written out separately: the row on the movie
 * page, the same row on the series page, and the poster's own `mx-auto`
 * centring below. All three said `lg` — 1024px — so at a tablet width a 260px
 * poster sat marooned in the middle of a ~900px row with a few hundred pixels
 * of inert gutter either side of it, and the synopsis began underneath. PostHog
 * logged the clicks that landed in that gutter: they hit the row itself, which
 * is layout, so nothing happened. From `md` the poster and the copy fill the
 * row between them and the gutter does not exist.
 *
 * Callers add their own stacking direction for the narrow case — the movie page
 * puts the poster first, the series page puts it after the information
 * (`flex-col-reverse`) — and both resolve to the same row here.
 */
export const DETAILS_ROW = 'flex gap-8 md:flex-row'

export const DetailsPoster = ({ path, alt }: { path: string; alt: string }) => (
  <div className="mx-auto w-full max-w-55 shrink-0 sm:max-w-65 md:mx-0 lg:w-100 lg:max-w-none">
    <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-xl lg:aspect-auto lg:min-h-150">
      <BlurredImage
        src={getImageURL(path)}
        alt={alt}
        className="size-full object-cover"
        fill
        sizes={POSTER_SIZES}
        quality={POSTER_QUALITY}
        intro
      />
    </div>
  </div>
)
