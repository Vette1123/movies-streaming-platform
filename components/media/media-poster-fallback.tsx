import { ItemType } from '@/types/movie-result'
import { cn } from '@/lib/utils'
import { MediaTypeIcon } from '@/components/media/media-type-icon'

// Shown in place of a poster when TMDB has no `poster_path`: a muted 2:3 box
// with the media-type glyph and a clamped title. Shared by the browse Card and
// the homepage static rail so both empty states stay identical. Pass `className`
// to tweak width/shadow per surface (twMerge lets it override the defaults).
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
      className={cn(
        'bg-muted text-muted-foreground flex aspect-2/3 w-full flex-col items-center justify-center gap-2 rounded-lg p-4 text-center',
        className
      )}
    >
      <MediaTypeIcon type={itemType} className="size-8 opacity-60" />
      <span className="line-clamp-3 text-xs font-medium">{title}</span>
    </div>
  )
}
