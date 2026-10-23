import { ItemType } from '@/types/movie-result'
import { tintBackground } from '@/lib/monogram'
import { cn } from '@/lib/utils'
import { MediaTypeIcon } from '@/components/media/media-type-icon'

// Shown in place of a poster when TMDB has no `poster_path`: a 2:3 card tinted
// from the title, the media-type glyph in a ring, and the title set like a
// poster's. Shared by every poster surface so all empty states stay identical.
// Pass `className` to tweak width/shadow per surface (twMerge lets it override
// the defaults).
export function MediaPosterFallback({
  itemType,
  title,
  className,
}: {
  itemType: ItemType
  title?: string
  className?: string
}) {
  return (
    <div
      style={tintBackground(title ?? '')}
      className={cn(
        'flex aspect-2/3 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg p-4 text-center ring-1 ring-white/10 ring-inset',
        className
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15">
        <MediaTypeIcon type={itemType} className="size-6" />
      </span>
      <span className="line-clamp-3 max-w-full text-sm font-semibold text-balance wrap-break-word text-white/90 drop-shadow-sm">
        {title}
      </span>
    </div>
  )
}
