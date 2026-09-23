'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, Smartphone, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { createTogetherRoomApi } from '@/lib/api-client'
import { matchCardHref, type MatchCard } from '@/lib/match-night'
import { hostHref } from '@/lib/watch-together'
import { Chip } from '@/components/ui/chip'
import { MediaSearchPicker } from '@/components/media-search-picker'

// Watch Together, step one: pick a title, mint a room, land on the detail
// page carrying ?watch=CODE&host=1. The sync itself lives in the player bar
// (components/watch-together-bar.tsx).
//
// This used to ask for a pasted Reely URL, which is a strange thing to ask of
// someone who is on Reely: to get the link you search the title, so the page
// searches the title. Same picker as the Match Night room.

export default function WatchTogetherPage() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  const start = async (card: MatchCard) => {
    if (busy) return
    setBusy(true)
    toast(`Opening a room for ${card.title}…`)
    try {
      const { code, key } = await createTogetherRoomApi()
      router.push(hostHref(matchCardHref(card), code, key))
    } catch {
      toast('Could not open a room. Try again.')
      setBusy(false)
    }
  }

  // The picker leads: it is the one thing to do on this page. The steps sit
  // under it as the explanation, where they used to sit above it as a list
  // to read before being allowed to act.
  return (
    <section className="container min-h-svh max-w-3xl py-20 lg:py-32">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Watch Together
        </h1>
        <Chip variant="outline" className="static">
          Beta
        </Chip>
      </div>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
        One of you presses play and everyone follows. Pauses and seeks sync for
        the whole room, so nobody is 40 seconds ahead spoiling the twist.
      </p>

      <div className="mt-10 max-w-xl">
        <MediaSearchPicker
          inputId="together-search"
          label="What are you watching?"
          placeholder="Search any film or series"
          takenLabel="Opening…"
          onPick={(card) => void start(card)}
        />
      </div>

      <ol className="mt-14 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3 sm:gap-6">
        {STEPS.map(({ Icon, title, body }, index) => (
          <li key={title} className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-full bg-primary/15 text-primary"
              >
                <Icon className="size-3.5" />
              </span>
              <span>
                <span className="sr-only">Step {index + 1}: </span>
                {title}
              </span>
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm text-muted-foreground">
        Joining someone? Open the link they sent. It already carries the room
        code.
      </p>
    </section>
  )
}

const STEPS = [
  {
    Icon: Search,
    title: 'Pick the title',
    body: 'Picking it opens a room and takes you straight to the player.',
  },
  {
    Icon: UserPlus,
    title: 'Send the invite',
    body: 'Invite, on the bar over the player. Anyone who opens it follows you.',
  },
  {
    Icon: Smartphone,
    title: 'Press play',
    body: 'Everyone stays in step. Your phone can be the remote: tap Remote and scan.',
  },
] as const
