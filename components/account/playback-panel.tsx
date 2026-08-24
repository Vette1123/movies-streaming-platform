'use client'

import Link from 'next/link'
import { EyeOff, Languages, Server, Sparkles } from 'lucide-react'

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
/**
 * Every language the player can actually fetch, in its own script — the same
 * fifty the picker inside the player offers, because they come from the same
 * table there (reely-pro-player src/languages.mjs). A language is listed only
 * once a catalog was measured to answer for it; a row that never resolves is
 * worse than no row, because it is picked, waited on, and empty.
 */
const SUB_LANGUAGES: { value: string; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'id', label: 'Indonesia' },
  { value: 'fa', label: 'فارسی' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'sv', label: 'Svenska' },
  { value: 'da', label: 'Dansk' },
  { value: 'no', label: 'Norsk' },
  { value: 'fi', label: 'Suomi' },
  { value: 'cs', label: 'Čeština' },
  { value: 'sk', label: 'Slovenčina' },
  { value: 'hu', label: 'Magyar' },
  { value: 'ro', label: 'Română' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'he', label: 'עברית' },
  { value: 'uk', label: 'Українська' },
  { value: 'bg', label: 'Български' },
  { value: 'sr', label: 'Srpski' },
  { value: 'hr', label: 'Hrvatski' },
  { value: 'bs', label: 'Bosanski' },
  { value: 'sl', label: 'Slovenščina' },
  { value: 'mk', label: 'Македонски' },
  { value: 'sq', label: 'Shqip' },
  { value: 'et', label: 'Eesti' },
  { value: 'lv', label: 'Latviešu' },
  { value: 'lt', label: 'Lietuvių' },
  { value: 'is', label: 'Íslenska' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ไทย' },
  { value: 'ms', label: 'Melayu' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'bn', label: 'বাংলা' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'ml', label: 'മലയാളം' },
  { value: 'ur', label: 'اردو' },
  { value: 'si', label: 'සිංහල' },
  { value: 'km', label: 'ខ្មែរ' },
  { value: 'my', label: 'မြန်မာ' },
]

const SUB_SIZES: {
  value: NonNullable<PlaybackPrefs['subSize']>
  label: string
}[] = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'l', label: 'Large' },
]

const MINI_BAR: { value: boolean; label: string }[] = [
  { value: false, label: 'Hidden' },
  { value: true, label: 'Shown' },
]

/**
 * A labelled row of chips where exactly one is chosen. Three settings use it;
 * the first two used to be the same twenty lines written twice.
 */
function PrefChips<T>({
  label,
  options,
  current,
  onPick,
  hint,
}: {
  label: string
  options: { value: T; label: string }[]
  current: T
  onPick: (value: T) => void
  hint?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      ) : null}
      {/* Long lists (the fifty subtitle languages) scroll in place rather
          than pushing every setting under them off the screen. */}
      <div
        className={cn(
          'mt-2 flex flex-wrap gap-2',
          options.length > 16 && 'max-h-48 overflow-y-auto pr-1'
        )}
      >
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={current === option.value}
            onClick={() => onPick(option.value)}
            className={cn(
              'focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
              current === option.value
                ? 'border-primary bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

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
        <PrefChips
          label="Subtitles"
          options={SUB_LANGUAGES}
          current={current.sub ?? 'off'}
          onPick={(sub) => setPref({ sub })}
        />
        <PrefChips
          label="Subtitle size"
          options={SUB_SIZES}
          current={current.subSize ?? 'm'}
          onPick={(subSize) => setPref({ subSize })}
        />
        <PrefChips
          label="Progress bar in full screen"
          hint="The thin line that stays lit at the bottom of the picture once the controls fade."
          options={MINI_BAR}
          current={current.miniBar ?? false}
          onPick={(miniBar) => setPref({ miniBar })}
        />
      </div>
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
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Preferred server</h3>
        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          Where streams start from on every device you sign in on. If one stops
          responding mid-title, the player moves to the next on its own and
          remembers that title needed it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {choosable.map((source) => {
          const isRich = source.id === RICH_SOURCE?.id
          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={source.id === current}
              onClick={() => void savePrefs({ source: source.id })}
              className={cn(
                'focus-visible:ring-ring rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden',
                isRich
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
              {isRich && <Sparkles className="size-3.5 shrink-0" />}
              {source.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
