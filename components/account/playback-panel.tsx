'use client'

import Link from 'next/link'
import { EyeOff, Languages, Server, Sparkles } from 'lucide-react'

import {
  HAS_FALLBACK_SOURCE,
  REELY_SOURCE_ID,
  STREAM_SOURCES,
} from '@/config/sources'
import { savePrefs } from '@/lib/account'
import {
  readPlaybackPrefs,
  writePlaybackPrefs,
  type PlaybackPrefs,
} from '@/lib/playback-prefs'
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
/**
 * Episode titles, hidden until you have watched them.
 *
 * Supporter-only because it rides `prefs`, which is the account: the whole
 * value is that it is already on when you open the next episode on the TV, and
 * a device-local version of it would be a worse feature wearing the same name.
 */
function SpoilerSection() {
  const { pro, prefs } = useAccount()
  if (!pro) {
    return (
      <SupporterGate
        title="Stop reading the next episode's title"
        Icon={EyeOff}
      >
        The season list sits directly under the player, and every episode title
        in it is a thing that has not happened to you yet. This hides the names
        of episodes you have not ticked off, leaving them as &ldquo;Episode
        4&rdquo; until you watch them, with one tap to show any of them anyway.
      </SupporterGate>
    )
  }
  return (
    <SettingSwitch
      label="Hide episode titles I have not watched"
      description="Episodes you have not ticked off show as &ldquo;Episode 4&rdquo; instead of their name, with a Show control on each one. Episodes you have already watched, and whatever is playing, always show their real title."
      checked={prefs.spoilerFree === true}
      onChange={(next) => void savePrefs({ spoilerFree: next })}
    />
  )
}

export function PlaybackPanel() {
  const lowPower = useLowPowerDevice()
  const hasHover = useHasHoverPointer()
  const mounted = useMounted()
  // The same default the hero composes, so this control and that one can never
  // disagree about what "never chosen" means on this device.
  const { enabled, toggle } = useHeroAutoplay(!lowPower && hasHover)

  return (
    <div className="space-y-8">
      <ReelySection />

      <ServerSection />

      <SpoilerSection />

      <div className="space-y-4">
        <SettingSwitch
          label="Autoplay trailers on the homepage"
          description="Plays a muted preview behind each hero slide. It costs several megabytes per slide, so it starts off on phones and on anything reporting a slow connection — this switch overrides that either way."
          checked={mounted ? enabled : false}
          onChange={toggle}
        />

        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Embed servers come from third parties that Reely does not host or
          control. The Reely Player above is ours — see the{' '}
          <Link href="/disclaimer" className="hover:text-foreground underline">
            disclaimer
          </Link>{' '}
          for what each of them means.
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
 * The Reely Player: our own playback surface, and the headline supporter
 * feature. Two settings — subtitle language and subtitle text size — applied
 * on boot of every title, on every device, because they ride the account
 * (`prefs.playback`) with a localStorage mirror for the player iframe to read
 * without a round trip (lib/playback-prefs.ts).
 */
const SUB_LANGUAGES: { value: string; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'it', label: 'Italiano' },
  { value: 'id', label: 'Indonesia' },
]

const SUB_SIZES: { value: NonNullable<PlaybackPrefs['subSize']>; label: string }[] =
  [
    { value: 's', label: 'Small' },
    { value: 'm', label: 'Medium' },
    { value: 'l', label: 'Large' },
  ]

function ReelySection() {
  const { pro, prefs } = useAccount()

  if (!pro) {
    return (
      <SupporterGate
        title="Your subtitles, on every title"
        Icon={Languages}
        surface="playback"
        cta="Unlock the Reely Player"
      >
        The Reely Player is Reely&rsquo;s own player: it loads faster than the embed
        servers, picks up where you left off automatically, and pulls real
        subtitles in your language — Arabic, English, French, Turkish and more —
        even when a title ships with none. Set your language once here and every
        title you open plays with it already on, at the size you like.
      </SupporterGate>
    )
  }

  const current: PlaybackPrefs = readPlaybackPrefs(prefs.playback ?? null)

  const setPref = (patch: PlaybackPrefs) => {
    void writePlaybackPrefs({ ...current, ...patch })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-3.5 shrink-0" />
          Reely Player
          <span className="rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 px-1.5 py-px text-[9px] leading-tight font-bold tracking-wider text-white">
            PRO
          </span>
        </h3>
        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Our own player — faster to start, resumes where you stopped, and puts
          subtitles in your language on titles that ship with none. These
          settings follow your account onto every device.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Subtitles</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUB_LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                aria-pressed={current.sub === lang.value}
                onClick={() => setPref({ sub: lang.value })}
                className={cn(
                  'focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                  current.sub === lang.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Subtitle size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUB_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                aria-pressed={current.subSize === size.value}
                onClick={() => setPref({ subSize: size.value })}
                className={cn(
                  'focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                  current.subSize === size.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
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
        {STREAM_SOURCES.map((source) => {
          const isReely = source.id === REELY_SOURCE_ID
          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={source.id === current}
              onClick={() => void savePrefs({ source: source.id })}
              className={cn(
                'focus-visible:ring-ring rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                isReely
                  ? cn(
                      'inline-flex items-center gap-1.5 border-transparent text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.55)]',
                      'bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 hover:shadow-[0_6px_20px_-2px_rgba(244,63,94,0.75)]',
                      source.id !== current && 'opacity-80'
                    )
                  : source.id === current
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {isReely && <Sparkles className="size-3.5 shrink-0" />}
              {source.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
