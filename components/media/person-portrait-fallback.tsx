import { initialsOf, tintBackground } from '@/lib/monogram'
import { cn } from '@/lib/utils'

// Shown in place of a headshot when TMDB has no `profile_path`: the person's
// initials in a ring on a card tinted from their name. The initials scale with
// the card (container units), so the same component fills a 110px people-grid
// tile and a 190px crew card alike. Decorative: the name is always printed
// beside it, so it is hidden from screen readers.
export function PersonPortraitFallback({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <div
      aria-hidden
      style={tintBackground(name)}
      className={cn(
        '@container grid aspect-2/3 w-full place-items-center overflow-hidden rounded-lg ring-1 ring-white/10 ring-inset',
        className
      )}
    >
      <span className="grid aspect-square w-[58%] place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
        <span className="text-[22cqw] leading-none font-bold tracking-wide text-white/90 drop-shadow-sm">
          {initialsOf(name)}
        </span>
      </span>
    </div>
  )
}
