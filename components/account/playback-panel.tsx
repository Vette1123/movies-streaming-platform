'use client'

import Link from 'next/link'
import { EyeOff, Languages, Sparkles } from 'lucide-react'

import {
  HAS_FALLBACK_SOURCE,
  RICH_SOURCE,
  STREAM_SOURCES,
  visibleSourcesFor,
} from '@/config/sources'
import { savePrefs } from '@/lib/account'
import {
  readPlaybackPrefs,
  writePlaybackPrefs,
  type PlaybackPrefs,
} from '@/lib/playback-prefs'
import { cn } from '@/lib/utils'
import { useAccount, useAccountIdentity } from '@/hooks/use-account'
import { useHasHoverPointer, useLowPowerDevice } from '@/hooks/use-device-tier'
import { useHeroAutoplay } from '@/hooks/use-hero-autoplay'
import { useMounted } from '@/hooks/use-mounted'

import {
  ChoiceChips,
  SettingGroup,
  SettingRow,
  SettingSwitch,
} from './controls'
import { SubtitleSelect } from './subtitle-select'
import { SupporterGate } from './supporter-gate'

/**
 * Playback settings.
 *
 * Only settings that something actually reads live here. The embed servers are
 * third parties, so there is still nothing to offer about quality or subtitles
 * on those — but which server a stream comes from is ours to choose, and
 * everything about the Reely Player is ours to choose.
 */

const SUB_SIZES = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
] as const

const MINI_BAR = [
  { id: 'hidden', label: 'Hidden' },
  { id: 'shown', label: 'Shown' },
] as const

export function PlaybackPanel() {
  const { pro, prefs } = useAccount()
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

      {!pro && (
        <SupporterGate
          title="Stop reading the next episode's title"
          Icon={EyeOff}
        >
          The season list sits directly under the player, and every episode
          title in it is a thing that has not happened to you yet. This hides
          the names of episodes you have not ticked off, leaving them as
          &ldquo;Episode 4&rdquo; until you watch them, with one tap to show any
          of them anyway.
        </SupporterGate>
      )}

      <SettingGroup>
        {pro && (
          <SettingSwitch
            label="Hide episode titles I have not watched"
            description="Episodes you have not ticked off show as &ldquo;Episode 4&rdquo; instead of their name, with a Show control on each one. Episodes you have already watched, and whatever is playing, always show their real title."
            checked={prefs.spoilerFree === true}
            onChange={(next) => void savePrefs({ spoilerFree: next })}
          />
        )}

        {pro && (
          <SettingSwitch
            label="Play the next episode automatically"
            description="When an episode finishes in the Reely Player, the next one in the season starts on its own. The last episode of a season stops rather than jumping to the next season."
            checked={prefs.autoNext === true}
            onChange={(next) => void savePrefs({ autoNext: next })}
          />
        )}

        <SettingSwitch
          label="Autoplay trailers on the homepage"
          description="Plays a muted preview behind each hero slide. It costs several megabytes per slide, so it starts off on phones and on anything reporting a slow connection. This switch overrides that either way."
          checked={mounted ? enabled : false}
          onChange={toggle}
        />
      </SettingGroup>

      <div className="space-y-3">
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          Embed servers come from third parties that Reely does not host or
          control. The Reely Player above is ours. See the{' '}
          <Link href="/disclaimer" className="underline hover:text-foreground">
            disclaimer
          </Link>{' '}
          for what each of them means.
        </p>

        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          Trailer autoplay is stored on this device rather than on your account:
          the right answer is different on a laptop and on a phone on cellular
          data.
        </p>
      </div>
    </div>
  )
}

/**
 * A heading for a block of settings.
 *
 * The panels used to write this as a `space-y-1` div with an `h3` and a `p` in
 * it, three times over, and the three had already drifted on gap and text size.
 */
function SectionHead({
  title,
  children,
  badge,
  Icon,
}: {
  title: string
  children: React.ReactNode
  badge?: React.ReactNode
  Icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        {title}
        {badge}
      </h3>
      <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

export function ProBadge() {
  return (
    <span className="rounded-full bg-linear-to-r from-amber-500 via-rose-500 to-fuchsia-600 px-1.5 py-px text-[9px] leading-tight font-bold tracking-wider text-white">
      PRO
    </span>
  )
}

/**
 * The Reely Player: our own playback surface, and the headline supporter
 * feature. Its settings ride the account (`prefs.playback`) with a localStorage
 * mirror the player iframe reads without a round trip (lib/playback-prefs.ts),
 * so they are already applied on boot of every title on every device.
 */
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
        The Reely Player is Reely&rsquo;s own player: it loads faster than the
        embed servers, picks up where you left off automatically, and pulls real
        subtitles in your language, Arabic and English and French and Turkish
        and more, even when a title ships with none. Set your language once here
        and every title you open plays with it already on, at the size you like.
      </SupporterGate>
    )
  }

  const current: PlaybackPrefs = readPlaybackPrefs(prefs.playback ?? null)

  const setPref = (patch: PlaybackPrefs) => {
    void writePlaybackPrefs({ ...current, ...patch })
  }

  return (
    <div className="space-y-4">
      <SectionHead title="Reely Player" Icon={Sparkles} badge={<ProBadge />}>
        Our own player: faster to start, resumes where you stopped, and puts
        subtitles in your language on titles that ship with none. These settings
        follow your account onto every device.
      </SectionHead>

      <SettingGroup>
        <SettingRow
          label="Subtitles"
          description="Loaded and switched on automatically wherever a catalog answers for the title."
        >
          <SubtitleSelect
            value={current.sub ?? 'off'}
            onSelect={(sub) => setPref({ sub })}
          />
        </SettingRow>

        <SettingRow label="Subtitle size">
          <ChoiceChips
            ariaLabel="Subtitle size"
            options={SUB_SIZES}
            value={current.subSize ?? 'm'}
            onSelect={(id) =>
              setPref({ subSize: id as NonNullable<PlaybackPrefs['subSize']> })
            }
          />
        </SettingRow>

        <SettingRow
          label="Progress bar in full screen"
          description="The thin line that stays lit at the bottom of the picture once the controls fade."
        >
          <ChoiceChips
            ariaLabel="Progress bar in full screen"
            options={MINI_BAR}
            value={current.miniBar ? 'shown' : 'hidden'}
            onSelect={(id) => setPref({ miniBar: id === 'shown' })}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}

/**
 * Which server streams play from.
 *
 * Switching needs an account (anonymous visitors always get the default), and
 * supporters additionally see our own player, which is also their automatic
 * default. A per-title override is written automatically whenever the switcher
 * on a player is used, and deliberately is not editable here: it is a memory of
 * what worked, not a setting.
 */
function ServerSection() {
  const { pro, prefs } = useAccount()
  const { signedIn } = useAccountIdentity()

  // A deployment with one server configured has nothing to say here, and an
  // empty "choose a server" heading would read as broken.
  if (!signedIn) return null
  if (!HAS_FALLBACK_SOURCE && !pro) return null

  const current = prefs.source ?? STREAM_SOURCES[0]?.id
  // The same list the player's switcher resolves for this account: the rich
  // surface appears here only for entitled accounts, so a stored choice for
  // it never dangles after support lapses.
  const choosable = visibleSourcesFor(signedIn === true, pro === true)

  return (
    <div className="space-y-4">
      <SectionHead title="Preferred server">
        Where streams start from on every device you sign in on. If one stops
        responding mid-title, the player moves to the next on its own and
        remembers that title needed it.
      </SectionHead>

      <SettingGroup>
        <SettingRow label="Start streams from">
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {choosable.map((source) => {
              const isRich = source.id === RICH_SOURCE?.id
              const active = source.id === current
              return (
                <button
                  key={source.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void savePrefs({ source: source.id })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
                    // The house player is not "another server", it is the
                    // product. It keeps the signature gradient whether or not
                    // it is the active one.
                    isRich
                      ? cn(
                          'border-transparent bg-linear-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white shadow-[0_4px_14px_-2px_rgba(244,63,94,0.55)]',
                          !active && 'opacity-80 hover:opacity-100'
                        )
                      : active
                        ? 'border-primary/70 bg-primary/15 text-foreground'
                        : 'border-white/10 text-muted-foreground hover:border-white/20 hover:bg-white/6 hover:text-foreground'
                  )}
                >
                  {isRich && <Sparkles className="size-3.5 shrink-0" />}
                  {source.label}
                </button>
              )
            })}
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
