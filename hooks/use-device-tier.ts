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
// lose the drifting zoom and the automatic trailer, not the hero. The trailer
// button still works on every device.

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

/**
 * True when the device should not be asked to run the hero's optional ambient
 * effects. Read once at mount: these values do not change, and re-reading them
 * per slide would be pure overhead.
 */
export function useLowPowerDevice(): boolean {
  const [lowPower] = React.useState(detectLowPower)
  return lowPower
}
