'use client'

import Link from 'next/link'
import { Server } from 'lucide-react'

import { HAS_FALLBACK_SOURCE, STREAM_SOURCES } from '@/config/sources'
import { savePrefs } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useHasHoverPointer, useLowPowerDevice } from '@/hooks/use-device-tier'
import { useHeroAutoplay } from '@/hooks/use-hero-autoplay'
import { useMounted } from '@/hooks/use-mounted'

import { SettingSwitch } from './controls'
import { SupporterGate } from './supporter-gate'

/**
 * Playback settings.
 *
 * Only settings that something actually reads live here. The player itself is a
 * third-party embed, so there is still nothing to offer about quality or
 * subtitles — but which server it comes from is ours to choose, and that is the
 * one that matters when a stream will not start.
 */
export function PlaybackPanel() {
  const lowPower = useLowPowerDevice()
  const hasHover = useHasHoverPointer()
  const mounted = useMounted()
  // The same default the hero composes, so this control and that one can never
  // disagree about what "never chosen" means on this device.
  const { enabled, toggle } = useHeroAutoplay(!lowPower && hasHover)

  return (
    <div className="space-y-8">
      <ServerSection />

      <div className="space-y-4">
        <SettingSwitch
          label="Autoplay trailers on the homepage"
          description="Plays a muted preview behind each hero slide. It costs several megabytes per slide, so it starts off on phones and on anything reporting a slow connection — this switch overrides that either way."
          checked={mounted ? enabled : false}
          onChange={toggle}
        />

        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Playback itself comes from a third-party embed that Reely does not
          host or control, which is why there is nothing here about quality or
          subtitles. See the{' '}
          <Link href="/disclaimer" className="hover:text-foreground underline">
            disclaimer
          </Link>{' '}
          for what that means.
        </p>

        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Trailer autoplay is stored on this device rather than on your account:
          the right answer is different on a laptop and on a phone on cellular
          data.
        </p>
      </div>
    </div>
  )
}

/**
 * Which server streams play from.
 *
 * The account preference, which is the one that follows somebody between
 * devices. A per-title override is written automatically whenever the switcher
 * on a player is used, and deliberately is not editable here: it is a memory of
 * what worked, not a setting, and a list of three hundred of them would be a
 * worse page rather than a more powerful one.
 */
function ServerSection() {
  const { pro, prefs } = useAccount()

  // A deployment with one server configured has nothing to say here, and an
  // empty "choose a server" heading would read as broken.
  if (!HAS_FALLBACK_SOURCE) return null

  if (!pro) {
    return (
      <SupporterGate
        title="Backup servers when a stream will not start"
        Icon={Server}
        surface="playback"
        cta="Unlock backup servers"
      >
        Streams come from a third party, and third parties have bad days — a
        server goes down, or simply never carried the title you picked, and the
        player sits there black. Supporters get every backup server Reely has:
        one tap to switch, an automatic hop when a server stops responding, and
        Reely remembers which one worked for which title so it does not happen
        twice.
      </SupporterGate>
    )
  }

  const current = prefs.source ?? STREAM_SOURCES[0]?.id

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Preferred server</h3>
        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Where streams start from on every device you sign in on. If one stops
          responding mid-title, the player moves to the next on its own and
          remembers that title needed it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STREAM_SOURCES.map((source) => (
          <button
            key={source.id}
            type="button"
            aria-pressed={source.id === current}
            onClick={() => void savePrefs({ source: source.id })}
            className={cn(
              'focus-visible:ring-ring rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              source.id === current
                ? 'border-primary bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            {source.label}
          </button>
        ))}
      </div>
    </div>
  )
}
