'use client'

import type { PublicList } from '@/lib/lists/routes'
import { PosterTile } from '@/components/media/poster-tile'
import { StrangerPitch } from '@/components/support/stranger-pitch'
import { SupporterBadge } from '@/components/support/supporter-badge'

/**
 * A published list, as a stranger sees it.
 *
 * The Worker renders the title, description, OG tags and JSON-LD for this page
 * server-side (see `handleListPage`) and hands over this shell to draw the
 * items, so an unfurl and a crawler get the real thing and the visitor gets the
 * posters. Both halves read the same row through `loadPublicList`, which is what
 * stops the page and its preview disagreeing.
 */
export function PublicListView({ list }: { list: PublicList }) {
  const count = list.items.length

  return (
    <div className="container max-w-6xl py-20 lg:py-28">
      <header className="mb-10 max-w-3xl space-y-3">
        <p className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
          {list.owner ? `A list by ${list.owner}` : 'A list on Reely'}
          {list.owner_pro && <SupporterBadge className="tracking-normal" />}
        </p>
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {list.name}
        </h1>
        {list.description && (
          <p className="text-muted-foreground max-w-[65ch] leading-relaxed">
            {list.description}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {count} {count === 1 ? 'title' : 'titles'}
        </p>
      </header>

      {count === 0 ? (
        <p className="text-muted-foreground">
          There is nothing in this list yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {list.items.map((item) => (
            <li key={`${item.type}:${item.id}`}>
              <PosterTile
                item={item}
                // One column of a 2/3/4/5-up grid inside a 72rem container.
                sizes="(min-width: 1024px) 14rem, (min-width: 640px) 30vw, 45vw"
              />
            </li>
          ))}
        </ul>
      )}

      <StrangerPitch
        surface="public_list"
        heading="This list was made on Reely, and Reely is free"
        cta="Make your own"
      />
    </div>
  )
}
