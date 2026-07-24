// Shared styling for the hero action pills — Trailer / Save / Mark watched /
// Share. The four components render the same-looking button, so the look lives
// here once: enhance it in this file, not in four call sites.
//
// - `heroActionButtonBase`: layout + motion shared by every state (lift on
//   hover, press-down on active, blur, drop-shadowed label).
// - `heroActionButtonIdle`: the default glassy surface. Stateful buttons swap it
//   for a tinted variant (see cyan/emerald below) once toggled on.

// Borderless glass: no hard 1px edge (it read as harsh over bright backdrops).
// Definition comes from the translucent fill, a soft inset top highlight, and a
// hover drop-shadow instead.
export const heroActionButtonBase =
  'relative w-11 gap-0 rounded-full px-0 text-white shadow-none backdrop-blur-md transition duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:w-auto sm:gap-2 sm:px-8'

export const heroActionButtonIdle =
  'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-white/20 hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.7)]'

// Active tints for the two toggle buttons, kept here so all hero-button styling
// stays in one place. A touch more fill than idle so the toggled-on state still
// reads without a border.
export const heroActionButtonSaved =
  'bg-cyan-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-cyan-400/30 hover:shadow-[0_10px_28px_-10px_rgba(34,211,238,0.5)]'

export const heroActionButtonWatched =
  'bg-emerald-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-emerald-400/30 hover:shadow-[0_10px_28px_-10px_rgba(52,211,153,0.5)]'
