import { Heart, ListMusic, Sparkles, User2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The one list of places an account can go, shared by the header popover and the
 * mobile drawer.
 *
 * Two hand-kept copies of this is how the drawer ends up missing the entry the
 * popover gained last week. The rows are rendered differently on each surface —
 * that part is presentation — but WHAT is on offer is decided once, here.
 */
export interface AccountDestination {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  /** Reads differently to someone who has already paid. */
  proLabel?: string
}

export const ACCOUNT_MENU: AccountDestination[] = [
  { href: '/account', label: 'Account', Icon: User2 },
  { href: '/account#lists', label: 'Your lists', Icon: ListMusic },
  { href: '/stats', label: 'Your year in Reely', Icon: Sparkles },
  {
    href: '/support',
    label: 'Support Reely',
    Icon: Heart,
    proLabel: 'Your plan',
  },
]

/**
 * The support page used to drop off a supporter's menu entirely, on the logic
 * that they had already done it. The effect was that the one person who most
 * needs to reach that page — to see what they are on, or change it — was the one
 * who could not find it from anywhere in the app. It stays, and says
 * "Your plan" instead.
 */
export const accountMenuFor = (pro: boolean): AccountDestination[] =>
  ACCOUNT_MENU.map((item) =>
    pro && item.proLabel ? { ...item, label: item.proLabel } : item
  )

/**
 * Google's avatar, or a monogram.
 *
 * A plain `<img>` rather than `next/image`: the source is a Google CDN host that
 * would need adding to the image config for one 40px request, and the optimiser
 * is disabled under `output: 'export'` anyway. `referrerPolicy` is what stops
 * Google returning a 403 for a hotlinked profile photo.
 */
const AVATAR_SIZE = {
  sm: 'size-7 text-xs',
  lg: 'size-9 text-sm',
  xl: 'size-14 text-lg',
} as const

export function AccountAvatar({
  name,
  email,
  picture,
  size = 'sm',
}: {
  name: string | null
  email: string | null
  picture: string | null
  size?: keyof typeof AVATAR_SIZE
}) {
  const box = AVATAR_SIZE[size]
  const initial = (name ?? email ?? '?').trim().charAt(0).toUpperCase()

  if (picture) {
    return (
      <img
        src={picture}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(box, 'shrink-0 rounded-full object-cover')}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        box,
        'bg-secondary text-secondary-foreground grid shrink-0 place-items-center rounded-full font-semibold'
      )}
    >
      {initial}
    </span>
  )
}
