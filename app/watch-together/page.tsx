'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createTogetherRoomApi } from '@/lib/api-client'
import { matchCardHref, type MatchCard } from '@/lib/match-night'
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
      const { code } = await createTogetherRoomApi()
      router.push(`${matchCardHref(card)}?watch=${code}&host=1`)
    } catch {
      toast('Could not open a room — try again')
      setBusy(false)
    }
  }

  return (
    <section className="container min-h-svh py-20 lg:py-32">
      <h1 className="text-2xl font-bold lg:text-3xl">Watch Together (beta)</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        One of you presses play — everyone follows. Pauses and seeks sync for
        the whole room, so nobody is 40 seconds ahead spoiling the twist.
      </p>

      <ol className="text-muted-foreground mt-6 max-w-md list-decimal space-y-1 pl-5 text-sm">
        <li>Search the film or series you want to watch</li>
        <li>Picking it opens a room and takes you to the player</li>
        <li>Send the invite from the bar — anyone who opens it follows you</li>
      </ol>

      <div className="mt-8 max-w-md">
        <MediaSearchPicker
          inputId="together-search"
          label="What are you watching?"
          placeholder="Search any film or series"
          takenLabel="Opening…"
          onPick={(card) => void start(card)}
        />
      </div>

      <p className="text-muted-foreground mt-8 text-xs">
        Guests: open the link the host sent — it already carries the room code.
      </p>
    </section>
  )
}
