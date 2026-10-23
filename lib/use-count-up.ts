import { useEffect, useState } from 'react'

/**
 * Counts `target` up from 0 over `duration` ms when the component mounts.
 * Returns the running value, floored to one decimal so a score like 8.4
 * reads "0 → 8.4" rather than flickering through every tenth. Respects
 * reduced motion: the value snaps to target at once.
 */
export function useCountUp(
  target: number | null,
  duration = 900
): number | null {
  // Starts at null on server AND client so hydration matches; callers render
  // their own final value for null, which is also the reduced-motion "snap".
  const [value, setValue] = useState<number | null>(null)

  useEffect(() => {
    if (target === null) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic so it arrives soft, not mechanical
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased * 10) / 10)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else setValue(target)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}
