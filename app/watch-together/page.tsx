'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { createTogetherRoomApi } from '@/lib/api-client'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Watch Together, step one: pick a title, mint a room, land on the detail
// page carrying ?watch=CODE&host=1. The sync itself lives in the player bar
// (components/watch-together-bar.tsx).

/** Accepts a full Reely URL or a bare /movies/123 path. */
export const parseMediaLink = (link: string): { path: string } | null => {
  try {
    const url = new URL(link.trim())
    return { path: url.pathname }
  } catch {
    // Not an absolute URL - accept a bare path if it looks like one.
    if (/^\/(movies|tv-shows)\/\d+/.test(link.trim())) {
      return { path: link.trim() }
    }
    return null
  }
}

export default function WatchTogetherPage() {
  const router = useRouter()
  const [link, setLink] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const start = async () => {
    const parsed = parseMediaLink(link)
    if (!parsed) {
      toast('Paste a Reely movie or TV link')
      return
    }
    setBusy(true)
    try {
      const { code } = await createTogetherRoomApi()
      router.push(`${parsed.path}?watch=${code}&host=1`)
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
        <li>Paste the Reely link of what you want to watch</li>
        <li>You get a code — send it to your people</li>
        <li>They open the same page with the code and hit play</li>
      </ol>

      <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.reely.space/movies/…"
          data-testid="together-link"
        />
        <button
          type="button"
          data-testid="together-start"
          onClick={() => void start()}
          disabled={busy}
          className={buttonVariants()}
        >
          {busy ? 'Opening…' : 'Start together'}
        </button>
      </div>

      <p className="text-muted-foreground mt-8 text-xs">
        Guests: open the link the host sent — it already carries the room code.
      </p>
    </section>
  )
}
