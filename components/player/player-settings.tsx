'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, Settings2 } from 'lucide-react'

import { savePrefs } from '@/lib/account'
import {
  readPlaybackPrefs,
  writePlaybackPrefs,
  type PlaybackPrefs,
} from '@/lib/playback-prefs'
import { cn } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ChoiceChips,
  SettingGroup,
  SettingRow,
  SettingSwitch,
} from '@/components/account/controls'
import { SubtitleSelect } from '@/components/account/subtitle-select'

/**
 * The Reely Player's settings, on the page that is playing.
 *
 * Subtitles were reachable from exactly one place: Settings, three clicks and a
 * lost position away from the title you were watching when you decided you
 * wanted them. The moment you want a subtitle language is the moment a line of
 * dialogue goes past unheard, and at that moment the player is what is on
 * screen. Same settings, same storage, same components as the account panel, in
 * the place where the question comes up.
 *
 * Only for supporters, because everything in here is a Reely Player setting and
 * the Reely Player is theirs. Non-supporters get the server buttons next door
 * and nothing that pretends to be a control over an embed we do not own.
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

export function PlayerSettings({
  isSeries,
  onNeedsReload,
  className,
}: {
  /** Series only: autoplay of the next episode has nothing to say on a film. */
  isSeries?: boolean
  /**
   * A setting changed that the running player reads only at boot.
   *
   * The player is an iframe on its own origin and its subtitle track is chosen
   * when it starts, so a change made mid-title would otherwise appear to do
   * nothing until the next title. The hero answers this by remounting the
   * frame, which mints a fresh ticket and comes back at the stored position.
   */
  onNeedsReload?: () => void
  className?: string
}) {
  const { pro, prefs } = useAccount()
  const [open, setOpen] = React.useState(false)

  if (!pro) return null

  const current: PlaybackPrefs = readPlaybackPrefs(prefs.playback ?? null)

  const setPref = (patch: PlaybackPrefs, reload = true) => {
    void writePlaybackPrefs({ ...current, ...patch })
    if (reload) onNeedsReload?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Player settings"
          className={cn(
            'focus-visible:ring-primary inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-2 focus-visible:outline-hidden',
            open && 'bg-white text-black hover:bg-white hover:text-black',
            className
          )}
        >
          <Settings2 className="size-3.5 shrink-0" aria-hidden />
          Settings
        </button>
      </PopoverTrigger>

      {/* Wider than a menu popover and above the player's own overlay. The
          trigger sits in a bar pinned to the top of the frame, so the panel
          opens downward over the picture rather than off the top of it. */}
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[60] w-[min(20rem,calc(100vw-2rem))] p-3"
      >
        <SettingGroup>
          <SettingRow label="Subtitles">
            <SubtitleSelect
              value={current.sub ?? 'off'}
              onSelect={(sub) => setPref({ sub })}
              align="end"
              className="max-w-none"
            />
          </SettingRow>

          <SettingRow label="Subtitle size">
            <ChoiceChips
              ariaLabel="Subtitle size"
              options={SUB_SIZES}
              value={current.subSize ?? 'm'}
              onSelect={(id) =>
                setPref({
                  subSize: id as NonNullable<PlaybackPrefs['subSize']>,
                })
              }
            />
          </SettingRow>

          <SettingRow label="Progress bar in full screen">
            <ChoiceChips
              ariaLabel="Progress bar in full screen"
              options={MINI_BAR}
              value={current.miniBar ? 'shown' : 'hidden'}
              onSelect={(id) => setPref({ miniBar: id === 'shown' })}
            />
          </SettingRow>

          {isSeries && (
            // Read when an episode ends rather than when the player boots, so
            // this one needs no reload to take effect.
            <SettingSwitch
              label="Play the next episode"
              checked={prefs.autoNext === true}
              onChange={(next) => void savePrefs({ autoNext: next })}
            />
          )}
        </SettingGroup>

        <Link
          href="/account#playback"
          className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 px-1 text-xs transition-colors"
        >
          All playback settings
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  )
}
