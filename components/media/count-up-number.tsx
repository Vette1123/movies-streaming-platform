'use client'

import { useEffect, useRef } from 'react'

import { useLowPowerDevice } from '@/hooks/use-device-tier'

/**
 * Counts a score up from 0 when it mounts, so the rating lands with a small
 * pop instead of appearing fully-formed.
 *
 * The one client island in the ratings strip: the strip itself stays a server
 * component so the real score is in the prerendered HTML for a crawler, and
 * this renders `score` verbatim on the server and on the first client render.
 *
 * The animation writes the span's text directly in a single rAF loop. It used
 * to setState every frame — four components re-rendering ~55 times each in the
 * first second of a details page, exactly while it hydrates. React never sees
 * the intermediate values; the last frame writes `score` itself back, so the
 * DOM ends identical to what React rendered. Skipped under reduced motion and
 * on low-power devices, where the number simply is there.
 */
export function CountUpNumber({
  score,
  duration = 900,
}: {
  score: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const lowPower = useLowPowerDevice()

  useEffect(() => {
    const el = ref.current
    const target = Number(score)
    if (!el || lowPower || Number.isNaN(target)) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const decimals = decimalsOf(score)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      if (progress < 1) {
        // ease-out cubic so it arrives soft, not mechanical
        const eased = 1 - Math.pow(1 - progress, 3)
        el.textContent = (target * eased).toFixed(decimals)
        frame = requestAnimationFrame(tick)
      } else {
        el.textContent = score
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      el.textContent = score
    }
  }, [score, duration, lowPower])

  return <span ref={ref}>{score}</span>
}

/** "8.4" → 1, "67" → 0: a Metacritic 67 must not land as "67.0". */
export function decimalsOf(score: string): number {
  return score.split('.')[1]?.length ?? 0
}
