import { describe, expect, it, vi } from 'vitest'

import { interactionGate } from '@/lib/interaction-gate'

describe('interactionGate', () => {
  it('holds a report until the first pointer or key press', () => {
    const target = new EventTarget()
    const gate = interactionGate(target)
    const fire = vi.fn()

    gate.whenInteracted(fire)
    expect(fire).not.toHaveBeenCalled()

    target.dispatchEvent(new Event('scroll'))
    expect(fire).not.toHaveBeenCalled()

    target.dispatchEvent(new Event('pointerdown'))
    expect(fire).toHaveBeenCalledTimes(1)

    target.dispatchEvent(new Event('keydown'))
    expect(fire).toHaveBeenCalledTimes(1)
  })

  it('reports at once when the visitor already interacted', () => {
    const target = new EventTarget()
    const gate = interactionGate(target)
    target.dispatchEvent(new Event('keydown'))

    const fire = vi.fn()
    gate.whenInteracted(fire)
    expect(fire).toHaveBeenCalledTimes(1)
  })

  it('never reports for a session that never interacts', () => {
    const target = new EventTarget()
    const gate = interactionGate(target)
    const fire = vi.fn()

    gate.whenInteracted(fire)
    gate.stop()
    target.dispatchEvent(new Event('pointerdown'))
    expect(fire).not.toHaveBeenCalled()
  })
})
