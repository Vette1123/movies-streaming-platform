'use client'

import { EyeOff, Undo2 } from 'lucide-react'

import { getPosterImageURL } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { useHiddenMedia } from '@/hooks/use-hidden-media'
import { Button } from '@/components/ui/button'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'

import { SupporterGate } from './supporter-gate'

/**
 * The titles you told Reely you are not interested in.
 *
 * This panel exists because the feature is otherwise a one-way door. Dismissing
 * something is a single tap on a suggestion tile, which makes it exactly the
 * kind of thing that gets tapped by accident on a phone — and a recommendation
 * engine that quietly stops showing you a film with no way to find out why is
 * worse than one that never learned anything.
 *
 * The full item is stored rather than an id (see hooks/use-hidden-media.ts), so
 * this can show the poster and the name. A list of numbers would be a list
 * nobody could undo.
 */
export function HiddenPanel() {
  const { pro } = useAccount()
  const { hidden, unhide, clear } = useHiddenMedia()

  if (!pro) {
    return (
      <SupporterGate title="Stop being shown the same thing you keep skipping">
        Dismiss anything in your suggestions and it stops coming back, on every
        device you sign in on. Reely also leaves it out of browse results, and
        this is where you can see everything you have hidden and undo any of it.
      </SupporterGate>
    )
  }

  if (hidden.length === 0) {
    return (
      <div className="max-w-[62ch] space-y-3 rounded-lg border border-dashed p-5">
        <p className="text-sm font-medium">Nothing hidden</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The dismiss control sits in the corner of every suggestion under
          &ldquo;Because you watched&rdquo;. Anything you dismiss stops
          appearing in suggestions and in browse results, on every device, and
          turns up here so you can undo it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {hidden.length} {hidden.length === 1 ? 'title is' : 'titles are'} kept
          out of your suggestions and browse results.
        </p>
        <Button variant="outline" size="sm" onClick={clear}>
          <Undo2 className="mr-2 size-4" />
          Show everything again
        </Button>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {hidden.map((item) => (
          <li key={`${item.type}-${item.id}`} className="space-y-2">
            <div className="relative overflow-hidden rounded-lg">
              {item.poster_path ? (
                <BlurredImage
                  src={getPosterImageURL(item.poster_path)}
                  alt={item.title}
                  width={342}
                  height={513}
                  quality={POSTER_QUALITY}
                  sizes="(min-width: 1024px) 9rem, (min-width: 640px) 20vw, 28vw"
                  className="aspect-2/3 w-full object-cover opacity-60"
                />
              ) : (
                <MediaPosterFallback
                  itemType={item.type === 'series' ? 'tv' : 'movie'}
                  title={item.title}
                />
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/35">
                <EyeOff className="size-5 text-white/80" aria-hidden />
              </span>
            </div>
            <p className="truncate text-xs font-medium">{item.title}</p>
            <button
              type="button"
              onClick={() => unhide(item.id)}
              className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-2"
            >
              Show again
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
