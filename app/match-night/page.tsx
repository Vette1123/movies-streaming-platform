'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Heart, PartyPopper, X } from 'lucide-react'
import { toast } from 'sonner'

import { Movie } from '@/types/movie-result'
import {
  createMatchRoomApi,
  getPopularApi,
  matchHitsApi,
  swipeApi,
  type MatchHit,
} from '@/lib/api-client'
import { interleave, swiperIdentity } from '@/lib/match-night'
import { getImageURL } from '@/lib/utils'
import { useMatchRoom } from '@/hooks/use-match-room'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Match Night: two people (or a whole couch), one room code, one deck of
// trending titles. Every like POSTs to the room; a 4s poll derives matches
// (two different swipers liked the same media). No accounts - the room code is
// the credential, rooms die after 12h.

const useDeck = (enabled: boolean) =>
  useQuery({
    queryKey: ['match-deck'],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const [movies, shows] = await Promise.all([
        getPopularApi('movie', 1),
        getPopularApi('tv', 1),
      ])
      const deck = interleave<Movie>(
        (movies.results ?? []).filter((m) => m.poster_path),
        (shows.results ?? []).filter((m) => m.poster_path)
      )
      return deck.slice(0, 30)
    },
  })

export default function MatchNightPage() {
  const [room, setRoom] = useMatchRoom()
  const [joinCode, setJoinCode] = React.useState('')
  const [index, setIndex] = React.useState(0)
  const { data: deck } = useDeck(true)

  // Poll for mutual likes while a room is live.
  const { data: matchData } = useQuery({
    queryKey: ['match-hits', room],
    enabled: !!room,
    refetchInterval: 4000,
    queryFn: () => matchHitsApi(room!),
  })

  const swipe = async (liked: boolean) => {
    const current = deck?.[index]
    if (!room || !current) return
    try {
      await swipeApi({
        code: room,
        swiper: swiperIdentity(),
        mediaId: current.id,
        mediaType: current.media_type === 'tv' ? 'tv' : 'movie',
        liked,
      })
    } catch {
      toast('Could not record that swipe — check your connection')
    }
    setIndex((i) => i + 1)
  }

  // Keyboard swiping: arrows are the whole interaction on a laptop.
  React.useEffect(() => {
    if (!room) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') void swipe(true)
      if (e.key === 'ArrowLeft') void swipe(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const createRoom = async () => {
    try {
      const { code } = await createMatchRoomApi()
      setRoom(code)
      toast(`Room ${code} — share it with your match`)
    } catch {
      toast('Could not open a room — try again')
    }
  }

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) {
      toast('Room codes are 6 characters')
      return
    }
    setRoom(code)
  }

  const current = deck?.[index]
  const hits = matchData?.matches ?? []
  const matchedNow = hits.length > 0

  return (
    <section className="container min-h-svh py-20 lg:py-32">
      <h1 className="text-2xl font-bold lg:text-3xl">Match Night</h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Two people, one deck. Both like the same title and it lights up as a
        match — the tonight-argument, settled.
      </p>

      {!room ? (
        <div className="mt-8 flex max-w-md flex-col gap-4">
          <button
            type="button"
            data-testid="match-create"
            onClick={() => void createRoom()}
            className={buttonVariants()}
          >
            Start a room
          </button>
          <div className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Or join with a code"
              maxLength={6}
              className="uppercase"
              data-testid="match-join-input"
            />
            <button
              type="button"
              onClick={joinRoom}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-muted-foreground mt-4 flex items-center gap-3 text-sm">
            <span>
              Room{' '}
              <span className="font-mono font-bold text-foreground">
                {room}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  `${location.origin}/match-night`
                )
                toast(
                  'Match Night link copied — your match joins with the code'
                )
              }}
              className="hover:text-foreground underline"
            >
              Copy invite
            </button>
            <button
              type="button"
              onClick={() => {
                setRoom(null)
                setIndex(0)
              }}
              className="hover:text-foreground underline"
            >
              Leave
            </button>
          </div>

          {matchedNow ? (
            <div
              data-testid="match-hit"
              className="border-primary bg-primary/10 mt-6 rounded-xl border p-6"
            >
              <p className="flex items-center gap-2 font-semibold">
                <PartyPopper className="text-primary size-5" />
                It&apos;s a match — {hits.length} title
                {hits.length > 1 ? 's' : ''} you both want
              </p>
              <div className="text-muted-foreground mt-2 text-xs">
                Keep swiping — more matches light up as you both agree.
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col items-center gap-6">
            {current ? (
              <>
                <div
                  data-testid="match-card"
                  className="relative w-64 overflow-hidden rounded-xl shadow-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageURL(current.poster_path ?? '')}
                    alt={current.title ?? current.name ?? ''}
                    className="aspect-[2/3] w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-3">
                    <p className="font-semibold text-white">
                      {current.title ?? current.name}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  ← / → to swipe · {index + 1} of {deck?.length ?? 0}
                </p>
                <div className="flex gap-6">
                  <button
                    type="button"
                    aria-label="Pass"
                    data-testid="match-pass"
                    onClick={() => void swipe(false)}
                    className="border-border/60 flex size-14 items-center justify-center rounded-full border transition hover:bg-red-500/10"
                  >
                    <X className="text-red-500" />
                  </button>
                  <button
                    type="button"
                    aria-label="Like"
                    data-testid="match-like"
                    onClick={() => void swipe(true)}
                    className="flex size-14 items-center justify-center rounded-full bg-emerald-600 transition hover:bg-emerald-500"
                  >
                    <Heart className="text-white" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground border-border/60 rounded-xl border border-dashed p-10 text-center text-sm">
                Deck done. Waiting on your match…
                <p className="mt-2 text-xs">
                  Matches light up the moment you both like the same title.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
