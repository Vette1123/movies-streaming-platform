// Hold a report until the visitor has touched the page.
//
// `image_host_fallback` alerts when wsrv.nl fails for real people. On
// 2026-11-11 it fired for 20 people, 19 of them a Chrome-on-Windows fleet that
// cannot fetch wsrv and never clicks, taps or types. On the real wsrv blip of
// 2026-10-30, 19 of the 33 who fell back did interact. So "has this visitor
// pressed anything" separates a host outage from a fleet that cannot load
// images, where no property sent at ingest does: the fleet rotates timezone,
// country and Chrome version, and shares its 1920x1080 screen with real people.

const INTERACTIONS = ['pointerdown', 'keydown'] as const

export interface InteractionGate {
  /** Run `fire` now if the visitor has interacted, else on their first press. */
  whenInteracted(fire: () => void): void
  /** Drop the listeners and anything still waiting. */
  stop(): void
}

export function interactionGate(target: EventTarget): InteractionGate {
  let interacted = false
  const waiting: Array<() => void> = []

  const onPress = () => {
    interacted = true
    detach()
    waiting.splice(0).forEach((fire) => fire())
  }
  const detach = () => {
    INTERACTIONS.forEach((type) =>
      target.removeEventListener(type, onPress, true)
    )
  }
  INTERACTIONS.forEach((type) =>
    target.addEventListener(type, onPress, { capture: true, passive: true })
  )

  return {
    whenInteracted(fire) {
      if (interacted) fire()
      else waiting.push(fire)
    },
    stop() {
      detach()
      waiting.length = 0
    },
  }
}
