'use client'

import Link from 'next/link'

import { useHasHoverPointer, useLowPowerDevice } from '@/hooks/use-device-tier'
import { useHeroAutoplay } from '@/hooks/use-hero-autoplay'
import { useMounted } from '@/hooks/use-mounted'

import { SettingSwitch } from './controls'

/**
 * Playback settings.
 *
 * Only settings that something actually reads live here. The hero's ambient
 * trailer is the one real playback preference this site has: the player itself
 * is a third-party embed, so there is no auto-next or quality control to offer,
 * and inventing switches that do nothing would be worse than a short panel.
 *
 * It is a device preference, not an account one — the same default that turns it
 * off on a phone is why. It is stored in localStorage and is free for everyone;
 * putting it here just means it is findable from somewhere other than the
 * homepage hero.
 */
export function PlaybackPanel() {
  const lowPower = useLowPowerDevice()
  const hasHover = useHasHoverPointer()
  const mounted = useMounted()
  // The same default the hero composes, so this control and that one can never
  // disagree about what "never chosen" means on this device.
  const { enabled, toggle } = useHeroAutoplay(!lowPower && hasHover)

  return (
    <div className="space-y-4">
      <SettingSwitch
        label="Autoplay trailers on the homepage"
        description="Plays a muted preview behind each hero slide. It costs several megabytes per slide, so it starts off on phones and on anything reporting a slow connection — this switch overrides that either way."
        checked={mounted ? enabled : false}
        onChange={toggle}
      />

      <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
        Playback itself comes from a third-party embed that Reely does not host
        or control, which is why there is nothing here about quality or
        subtitles. See the{' '}
        <Link href="/disclaimer" className="hover:text-foreground underline">
          disclaimer
        </Link>{' '}
        for what that means.
      </p>

      <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
        This one is stored on this device rather than on your account: the right
        answer is different on a laptop and on a phone on cellular data.
      </p>
    </div>
  )
}
