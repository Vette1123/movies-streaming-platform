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

export const DetailsPoster = ({ path, alt }: { path: string; alt: string }) => (
  <div className="mx-auto w-full max-w-[220px] shrink-0 sm:max-w-[260px] lg:mx-0 lg:w-[400px] lg:max-w-none">
    <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-xl lg:aspect-auto lg:min-h-[600px]">
      <BlurredImage
        src={getImageURL(path)}
        alt={alt}
        className="h-full w-full object-cover"
        fill
        sizes={POSTER_SIZES}
        quality={POSTER_QUALITY}
        intro
      />
    </div>
  </div>
)
