// Shared styling for the hero action pills — Trailer / Save / Mark watched /
// Share / Share card. The components render the same-looking button, so the look
// lives here once: enhance it in this file, not in the call sites.
//
// - `heroActionButtonBase`: layout + motion shared by every state (lift on
//   hover, press-down on active, blur, drop-shadowed label).
// - `heroActionButtonIdle`: the default glassy surface. Stateful buttons swap it
//   for a tinted variant (see cyan/emerald below) once toggled on.

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// Borderless glass: no hard 1px edge (it read as harsh over bright backdrops).
// Definition comes from the translucent fill, a soft inset top highlight, and a
// hover drop-shadow instead.
export const heroActionButtonBase =
  'relative w-11 gap-0 rounded-full px-0 text-white shadow-none backdrop-blur-md transition-[transform,background-color,box-shadow] duration-200 will-change-transform [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:w-auto sm:gap-2 sm:px-8'

export const heroActionButtonIdle =
  'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/20 hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.7)]'

// Active tints for the two toggle buttons, kept here so all hero-button styling
// stays in one place. A touch more fill than idle so the toggled-on state still
// reads without a border, and a slight scale pop so a saved/watch state feels
// like something happened under the finger.
export const heroActionButtonSaved =
  'bg-cyan-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-cyan-400/30 hover:shadow-[0_10px_28px_-10px_rgba(34,211,238,0.5)] scale-105'

export const heroActionButtonWatched =
  'bg-emerald-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-emerald-400/30 hover:shadow-[0_10px_28px_-10px_rgba(52,211,153,0.5)] scale-105'

// Icon-only at every width. The pills drop their label below `sm` anyway; this
// drops it above too (the label is the button's direct child <span>) and keeps
// the 44px circle. Every hero action carries an aria-label, so the name
// survives, and the detail hero prints a caption for it.
export const heroActionIconOnly = 'sm:w-11 sm:gap-0 sm:px-0 sm:[&>span]:hidden'

// The hero's primary action: Watch Now on the homepage, Play on a detail page.
// One string, so the two heroes cannot drift into two different buttons.
//
// cn(), not buttonVariants' own `className` slot: cva only concatenates, so the
// size's px-12 would still win over the mobile override. twMerge actually
// replaces it. Tighter pill below sm: at 367px wide the full-size pill made the
// homepage row 345px against a 327px container, so Save wrapped to a second
// row and ate ~54px of vertical space the copy needed.
export const heroWatchButton = cn(
  buttonVariants({ variant: 'watchNow', size: '2xl' }),
  'hero-pulse rounded-full px-5 text-lg sm:px-12 sm:text-xl'
)
