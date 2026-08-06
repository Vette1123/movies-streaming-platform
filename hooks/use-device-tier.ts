'use client'

import React from 'react'

// What the hero is allowed to spend on ambience, decided once from what the
// device tells us about itself.
//
// The hero has two effects that run continuously rather than once: a 14s Ken
// Burns scaling a full-viewport backdrop, and a muted trailer that autoplays a
// second after each slide takes the frame. On a desktop both are free. On a
// weak phone they are the frame budget — an embedded player is spun up and torn
// down every time the carousel rotates, on top of a full-screen animation that
// never stops. That is what "laggy on old phones" actually is; no amount of
// transform tuning reaches it, because the cost is not in the transform.
//
// So the ambience is treated as an enhancement and skipped where it hurts. The
// slide, its artwork, the copy and the controls are identical either way — you
// lose the drifting zoom, and trailer autoplay starts turned OFF. The trailer
// button still works on every device.
//
// This hook governs the Ken Burns pan. Trailer autoplay takes a second signal on
// top of it — useHasHoverPointer below — because the embed costs ~6.9MB and no
// touch device should spend that on ambience by default, however many cores it
// reports. Composed at the call site in hero-slide.tsx, not folded in here: the
// two effects have genuinely different budgets.
//
// This is a DEFAULT, not a veto: the hero's autoplay toggle writes an explicit
// preference that wins over this heuristic (see use-hero-autoplay). Gating
// playback on the tier directly meant a phone showed the toggle switched on
// while no trailer could ever start.

/** Signals that mean "do not spend anything optional here". */
function detectLowPower(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    // SSR / prerender: assume the cheap path. Being wrong this way costs a
    // desktop its Ken Burns for one render; being wrong the other way ships a
    // phone the expensive path before it can say otherwise.
    return true
  }

  // The user asked for less data. Autoplaying a video against that is rude.
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  if (connection?.saveData) return true

  // Chrome-only, absent elsewhere — hence `?? Infinity`, so a browser that does
  // not report is never demoted on a missing value alone.
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
    Infinity
  if (memory <= 4) return true

  const cores = navigator.hardwareConcurrency ?? Infinity
  if (cores <= 4) return true

  return false
}

// Read once per document, not per render: these signals cannot change, and
// useSyncExternalStore calls getSnapshot on every render.
let detected: boolean | undefined
const getSnapshot = () => (detected ??= detectLowPower())

// The hydration render must agree with the exported HTML, which was prerendered
// with no navigator at all. See the note on useLowPowerDevice.
const getServerSnapshot = () => true

// Nothing to subscribe to — the value is fixed for the life of the document.
const subscribe = () => () => {}

/**
 * True when the device should not be asked to run the hero's optional ambient
 * effects.
 *
 * The subtlety here is hydration, not detection. Seeding `useState` with
 * `detectLowPower` runs the initializer during the HYDRATION render, where
 * `navigator` is real — so a capable desktop computed `false` on the very first
 * client render while the exported HTML said `true`, and the hero backdrop
 * hydrated with `animate-hero-kenburns` against markup that had no such class.
 * React reports that as "a tree hydrated but some attributes of the server
 * rendered HTML didn't match" and, as the message says, does NOT patch it up.
 *
 * `useSyncExternalStore` is the API for exactly this: it uses
 * `getServerSnapshot` for the hydration render and switches to `getSnapshot`
 * immediately after, so the markup matches and the real answer still arrives.
 * This replaced a `useEffect(() => setLowPower(...), [])`, which behaved the
 * same but is a synchronous setState inside an effect — a cascading render that
 * `react-hooks/set-state-in-effect` (correctly) rejects.
 *
 * The cost is one extra render on capable devices and the Ken Burns starting a
 * frame later. That is the right trade for ambience: it is an enhancement, and
 * an enhancement must never be what breaks hydration for the page under it.
 */
export function useLowPowerDevice(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** A real pointer that can hover — a mouse or trackpad, not a finger. */
function detectHoverPointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

let hoverDetected: boolean | undefined
const getHoverSnapshot = () => (hoverDetected ??= detectHoverPointer())

// Prerendered HTML is built ONCE and served to every device, so this answer has
// to pick a side. It picks touch, deliberately, and the asymmetry is the whole
// point: a desktop that starts on the touch tree pays one extra render to
// upgrade, while a phone that started on the hover tree would have to build
// every hover-only component first and then throw it away — which is exactly the
// cost this exists to avoid. Same trade, same reasoning, as getServerSnapshot
// above.
const getHoverServerSnapshot = () => false

/**
 * True only where hover interactions can actually happen.
 *
 * Callers use this to skip mounting hover-only machinery on touch, where it can
 * never run. The homepage mounts 72 cards, each of which was building a Radix
 * HoverCard and a framer motion component for a pointer the device does not
 * have. Measured at 6x CPU throttle on a 393px viewport, the homepage spent
 * 7-8s in long tasks with scrolling itself nearly free — the cost is mount, not
 * motion, so the fix is to not mount it.
 *
 * `useSyncExternalStore` rather than a `useState` initialiser for the same
 * reason as `useLowPowerDevice`: the initialiser would run during hydration,
 * where `matchMedia` is real, and return a different answer than the exported
 * HTML — which React reports as a hydration mismatch and does NOT patch up.
 */
export function useHasHoverPointer(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    getHoverSnapshot,
    getHoverServerSnapshot
  )
}
