import type { ComponentType } from 'react'

import { COMPANION_APPS } from '@/lib/apps'
import { cn } from '@/lib/utils'

type IconProps = { className?: string }

/**
 * Each companion app's real launcher icon (public/apps/<slug>.webp, made by
 * `pnpm apps:icons`), as an `Icon`-shaped component so it drops into the same
 * slots the generic phone glyph used: PopoverRow, DrawerAction and the command
 * menu. One component per app, built once, so a re-render never remounts it.
 *
 * A plain <img>: a 120px file shown at 24-36 CSS px, so next/image buys
 * nothing here, and the rounded corner is the store icon's own squircle.
 */
function makeIcon(slug: string, name: string): ComponentType<IconProps> {
  function AppIcon({ className }: IconProps) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/apps/${slug}.webp`}
        alt=""
        width={120}
        height={120}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={cn(
          'shrink-0 rounded-[22%] object-cover shadow-sm ring-1 ring-white/10',
          className
        )}
      />
    )
  }
  AppIcon.displayName = `AppIcon(${name})`
  return AppIcon
}

export const APP_ICONS: Record<
  string,
  ComponentType<IconProps>
> = Object.fromEntries(
  COMPANION_APPS.map((app) => [app.slug, makeIcon(app.slug, app.name)])
)
