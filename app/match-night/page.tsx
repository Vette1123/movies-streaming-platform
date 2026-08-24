'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clapperboard, LogOut, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import {
  createMatchRoomApi,
  getPopularApi,
  matchHitsApi,
  swipeApi,
} from '@/lib/api-client'
import {
  cardKey,
  dedupeCards,
  interleave,
  swiperIdentity,
  toMatchCard,
  type MatchCard,
} from '@/lib/match-night'
import { getPosterImageURL } from '@/lib/utils'
import { useMatchRoom } from '@/hooks/use-match-room'
import { useShare } from '@/hooks/use-share'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MatchPanel } from '@/components/match-night/match-panel'
import { SwipeDeck } from '@/components/match-night/swipe-deck'
import { MediaSearchPicker } from '@/components/media-search-picker'

// Match Night: two people, one room code, one deck. Both like the same title
// and it lights up as a match.
//
// The three things that made the first version feel broken, and where they are
// fixed:
//  - every swipe awaited the POST before the card moved. A decision now lands
//    on screen immediately and the swipe is reported in the background (`decide`
//    below); the room is eventually consistent either way, since matches are
//    derived in SQL on read.
//  - the deck was 30 fixed trending titles with no way to put a specific film
//    in front of the room. `DeckSearch` queues any title as the next card.
//  - the match panel showed a count and nothing else. It shows the posters now,
//    resolved from this browser's own likes - a match requires your like, so the
//    artwork is always already here and costs no request.

/** Two pages of each type. ~80 cards is more than one night of swiping, and it
 * is four edge-cached Worker calls, made once per session. */
const DECK_PAGES = [1, 2]

/** Poll cadence while someone is swiping, and once the room goes quiet. */
const ACTIVE_POLL_MS = 4000
const IDLE_POLL_MS = 15000
const ACTIVE_WINDOW_MS = 90000

const likedStorageKey = (room: string) => `match-night-history-${room}`

interface Decision {
  card: MatchCard
  liked: boolean
}

const readHistory = (room: string): Decision[] => {
  try {
    const raw = localStorage.getItem(likedStorageKey(room))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeHistory = (room: string, history: Decision[]) => {
  try {
    localStorage.setItem(likedStorageKey(room), JSON.stringify(history))
  } catch {
    // A full or blocked localStorage costs the session its place in the deck,
    // never the session itself.
  }
}

const useDeck = () =>
  useQuery({
    queryKey: ['match-deck'],
    staleTime: Infinity,
    queryFn: async () => {
      const responses = await Promise.all([
        ...DECK_PAGES.map((page) => getPopularApi('movie', page)),
        ...DECK_PAGES.map((page) => getPopularApi('tv', page)),
      ])
      const half = DECK_PAGES.length
      const withPoster = (index: number, type: 'movie' | 'tv') =>
        (responses[index].results ?? [])
          .filter((item) => item.poster_path)
          .map((item) => toMatchCard(item, type))
      const movies = DECK_PAGES.flatMap((_, i) => withPoster(i, 'movie'))
      const shows = DECK_PAGES.flatMap((_, i) => withPoster(half + i, 'tv'))
      return dedupeCards(interleave<MatchCard>(movies, shows))
    },
  })

/** A fanned trio of tonight's real posters. Gives the empty state something to
 * look at that is actually the deck you are about to swipe. */
function DeckPreview({ cards }: { cards: MatchCard[] }) {
  const trio = cards.slice(0, 3)
  if (trio.length < 3) {
    return <div className="hidden aspect-4/3 lg:block" aria-hidden />
  }
  const tilts = [
    '-rotate-12 -translate-x-8',
    'z-10 scale-110',
    'rotate-12 translate-x-8',
  ]
  return (
    <div
      aria-hidden
      className="relative hidden items-center justify-center lg:flex"
    >
      <div className="bg-primary/15 absolute size-72 rounded-full blur-3xl" />
      {trio.map((card, i) => (
        <div
          key={card.id}
          className={`relative w-40 overflow-hidden rounded-2xl border border-white/10 shadow-2xl ${tilts[i]}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getPosterImageURL(card.poster ?? '')}
            alt=""
            loading="lazy"
            className="aspect-2/3 w-full object-cover"
          />
        </div>
      ))}
    </div>
  )
}

function StartScreen({
  deck,
  onCreate,
  onJoin,
  creating,
}: {
  deck: MatchCard[]
  onCreate: () => void
  onJoin: (code: string) => void
  creating: boolean
}) {
  const [code, setCode] = React.useState('')

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Settle it in
          <span className="text-primary"> six swipes</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">
          Open a room, send the code, and swipe the same deck. Anything you both
          like lights up instantly.
        </p>

        <div className="mt-8 flex max-w-md flex-col gap-3">
          <Button
            size="lg"
            data-testid="match-create"
            disabled={creating}
            onClick={onCreate}
            className="gap-2 rounded-full"
          >
            <Sparkles className="size-4" aria-hidden />
            {creating ? 'Opening a room…' : 'Start a room'}
          </Button>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onJoin(code)
            }}
          >
            <label htmlFor="match-join" className="sr-only">
              Room code
            </label>
            <Input
              id="match-join"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Have a code? ABC123"
              maxLength={6}
              autoComplete="off"
              className="font-mono tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:normal-case"
              data-testid="match-join-input"
            />
            <Button
              type="submit"
              variant="secondary"
              className="shrink-0 rounded-full px-6"
            >
              Join
            </Button>
          </form>
        </div>

        <p className="text-muted-foreground mt-8 max-w-md text-sm leading-relaxed">
          No account, nothing saved to a profile. The code is the whole
          credential and the room clears itself after 12 hours.
        </p>
      </div>

      <DeckPreview cards={deck} />
    </div>
  )
}

export default function MatchNightPage() {
  const [room, setRoom] = useMatchRoom()
  const [creating, setCreating] = React.useState(false)
  const [history, setHistory] = React.useState<Decision[]>([])
  const [queued, setQueued] = React.useState<MatchCard[]>([])
  const { data: deck } = useDeck()
  const { share } = useShare()

  // A shared link carries the code, so the second person never types it. Read
  // from window.location rather than useSearchParams: this route is exported
  // statically and a search-params hook would bail the whole page to CSR.
  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search)
      .get('room')
      ?.trim()
      .toUpperCase()
    if (code?.length !== 6) return
    setRoom(code)
    // Drop the parameter once it has been used, so leaving the room and
    // reloading does not silently drop you back into it.
    window.history.replaceState(null, '', window.location.pathname)
  }, [setRoom])

  // Your place in the deck survives a reload, and so do the likes the match
  // panel resolves its posters from. Adjusted during render rather than in an
  // effect: an effect would paint one frame of the previous room's deck first,
  // and React re-runs this render before committing anything.
  const [loadedRoom, setLoadedRoom] = React.useState<string | null>(null)
  if (loadedRoom !== room) {
    setLoadedRoom(room)
    setHistory(room ? readHistory(room) : [])
    setQueued([])
  }

  // The match poll is the only thing on this page that costs a Worker
  // invocation per tick, so it is paced by whether anyone is actually swiping.
  // A room left open on a second tab used to burn 900 invocations an hour
  // against a 100k/day account cap; idle rooms now cost a quarter of that, and
  // TanStack already parks the interval entirely while the tab is in the
  // background.
  const lastSwipeAt = React.useRef(0)

  const { data: matchState } = useQuery({
    queryKey: ['match-hits', room],
    enabled: !!room,
    refetchInterval: () =>
      Date.now() - lastSwipeAt.current < ACTIVE_WINDOW_MS
        ? ACTIVE_POLL_MS
        : IDLE_POLL_MS,
    queryFn: () => matchHitsApi(room!),
  })

  // A match is the whole point of the page, and the panel can be off screen on
  // a phone. Announce each new one once - keyed by type AND id, because a film
  // and a series share id space.
  //
  // The first payload for a room is history rather than news: rejoining a room
  // you had already matched in fired a toast per old match, all at once.
  const announced = React.useRef<{ room: string | null; keys: Set<string> }>({
    room: null,
    keys: new Set(),
  })
  React.useEffect(() => {
    if (!room || !matchState) return
    const seeding = announced.current.room !== room
    if (seeding) announced.current = { room, keys: new Set() }
    for (const hit of matchState.matches) {
      const key = cardKey({ id: hit.media_id, mediaType: hit.media_type })
      if (announced.current.keys.has(key)) continue
      announced.current.keys.add(key)
      if (seeding) continue
      toast('It is a match', { description: 'You both want to watch this one' })
    }
  }, [matchState, room])

  const decidedKeys = React.useMemo(
    () => new Set(history.map((entry) => cardKey(entry.card))),
    [history]
  )

  const cards = React.useMemo(() => {
    const all = dedupeCards([...queued, ...(deck ?? [])])
    return all.filter((card) => !decidedKeys.has(cardKey(card)))
  }, [queued, deck, decidedKeys])

  const likedByKey = React.useMemo(() => {
    const map: Record<string, MatchCard> = {}
    for (const entry of history) {
      if (entry.liked) map[cardKey(entry.card)] = entry.card
    }
    return map
  }, [history])

  const report = React.useCallback(
    (code: string, card: MatchCard, liked: boolean) => {
      // Fire and forget. The deck has already moved; a failed swipe costs one
      // vote, and the toast says so rather than freezing the card.
      void swipeApi({
        code,
        swiper: swiperIdentity(),
        mediaId: card.id,
        mediaType: card.mediaType,
        liked,
      }).catch(() => toast('That swipe did not reach the room'))
    },
    []
  )

  const decide = React.useCallback(
    (card: MatchCard, liked: boolean) => {
      if (!room) return
      lastSwipeAt.current = Date.now()
      const next = [...history, { card, liked }]
      writeHistory(room, next)
      setHistory(next)
      setQueued((prev) =>
        prev.filter((item) => cardKey(item) !== cardKey(card))
      )
      report(room, card, liked)
    },
    [room, history, report]
  )

  const undo = React.useCallback(() => {
    const last = history[history.length - 1]
    if (!room || !last) return
    const next = history.slice(0, -1)
    writeHistory(room, next)
    setHistory(next)
    // Taking back a like has to reach the room too, or an undone title can
    // still light up as a match on the other phone.
    if (last.liked) report(room, last.card, false)
    const inDeck = (deck ?? []).some(
      (card) => cardKey(card) === cardKey(last.card)
    )
    if (!inDeck) setQueued((prev) => dedupeCards([last.card, ...prev]))
  }, [room, history, deck, report])

  const createRoom = async () => {
    setCreating(true)
    try {
      const { code } = await createMatchRoomApi()
      setRoom(code)
      toast(`Room ${code} is open — send the invite`)
    } catch {
      toast('Could not open a room. Try again in a moment')
    } finally {
      setCreating(false)
    }
  }

  const joinRoom = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (code.length !== 6) {
      toast('Room codes are 6 characters')
      return
    }
    setRoom(code)
  }

  const leaveRoom = () => {
    setRoom(null)
    setHistory([])
    setQueued([])
  }

  if (!room) {
    return (
      <section className="container flex min-h-svh flex-col justify-center py-24">
        <StartScreen
          deck={deck ?? []}
          onCreate={() => void createRoom()}
          onJoin={joinRoom}
          creating={creating}
        />
      </section>
    )
  }

  const hits = matchState?.matches ?? []

  return (
    <section className="container min-h-svh pt-20 pb-12 lg:pt-24">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-muted-foreground text-sm">Room</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(room)
              toast('Code copied')
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-base font-bold tracking-[0.2em] transition hover:border-white/25 sm:px-3 sm:py-1.5 sm:text-lg sm:tracking-[0.3em]"
            aria-label={`Room code ${room.split('').join(' ')}, copy`}
          >
            {room}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 rounded-full"
            onClick={() =>
              void share({
                title: 'Match Night on Reely',
                path: `/match-night?room=${room}`,
              })
            }
          >
            <Share2 className="size-4" aria-hidden />
            Invite
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-2 rounded-full"
            onClick={leaveRoom}
          >
            <LogOut className="size-4" aria-hidden />
            Leave
          </Button>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <SwipeDeck
          cards={cards}
          onDecide={decide}
          onUndo={undo}
          canUndo={history.length > 0}
          onFind={() => {
            const input = document.getElementById('match-search')
            input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // A focus during a smooth scroll fights it on iOS; let it land.
            window.setTimeout(() => input?.focus({ preventScroll: true }), 400)
          }}
          remaining={cards.length}
          emptyState={
            <div className="border-border/60 text-muted-foreground w-full max-w-sm rounded-2xl border border-dashed p-10 text-center">
              <Clapperboard className="mx-auto size-8 opacity-60" aria-hidden />
              <p className="text-foreground mt-4 font-medium">
                {deck ? 'That is the whole deck' : 'Dealing the deck…'}
              </p>
              {deck ? (
                <p className="mt-2 text-sm leading-relaxed">
                  Search a title to keep going, or check what you have already
                  agreed on.
                </p>
              ) : null}
            </div>
          }
        />

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          <MatchPanel
            hits={hits}
            swipers={matchState?.swipers ?? 0}
            cardsByKey={likedByKey}
          />
          <div className="border-border/60 border-t pt-6">
            <MediaSearchPicker
              inputId="match-search"
              label="Something specific in mind?"
              placeholder="Search any film or series"
              takenKeys={new Set([...queued.map(cardKey), ...decidedKeys])}
              onPick={(card) => {
                setQueued((prev) => dedupeCards([card, ...prev]))
                toast(`${card.title} is up next`)
              }}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
