import { useEffect, useCallback, useRef } from 'react'

/**
 * Tilts an element slightly based on the cursor's position within it, so a
 * card feels like a physical object catching the light. Only runs on
 * hover-capable devices; the element returns to flat when the pointer leaves.
 * Transforms are compositor-only.
 */
export function useTilt(ref: React.RefObject<HTMLElement | null>, strength = 4) {
  const onMove = useCallback(
    (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Rotate around the card's center: right side tilts down, left side up,
      // bottom tilts toward the viewer, top away. Subtle degrees.
      const rotateX = ((y / rect.height) - 0.5) * -strength
      const rotateY = ((x / rect.width) - 0.5) * strength
      el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    },
    [ref, strength]
  )

  const onLeave = useCallback(() => {
    const el = ref.current
    if (el) el.style.transform = ''
  }, [ref])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      el.style.transform = ''
    }
  }, [ref, onMove, onLeave])
}
