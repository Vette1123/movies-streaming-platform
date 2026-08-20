'use client'

import { LogIn, LogOut } from 'lucide-react'

import { signInHref, signOut } from '@/lib/account'
import { useAccountIdentity } from '@/hooks/use-account'
import {
  AccountAvatar,
  accountMenuFor,
} from '@/components/account/account-identity'
import { DrawerAction, DrawerSection } from '@/components/layouts/drawer-action'

/**
 * The account block at the top of the mobile drawer.
 *
 * On a phone the header keeps one 40px control, which is enough to get to the
 * account but not enough to say who is signed in or what an account is for. The
 * drawer is where that belongs: it opens with the answer already on screen.
 *
 * Read-only — the header's `AccountControl` owns the refresh, and this renders
 * whatever it found. Opening the drawer costs no request.
 */
export function AccountDrawerSection({
  onNavigate,
}: {
  onNavigate: () => void
}) {
  const { ready, signedIn, name, email, picture, pro } = useAccountIdentity()

  // The drawer is opened by a tap, long after hydration, so the unready case is
  // effectively only the first paint of a cold load. A placeholder row keeps the
  // sections below from jumping if it is ever seen.
  if (!ready) {
    return <div aria-hidden className="h-11" />
  }

  if (!signedIn) {
    return (
      <DrawerSection title="Account">
        <DrawerAction
          Icon={LogIn}
          label="Sign in with Google"
          tone="accent"
          href={signInHref('/account')}
          onClick={onNavigate}
        />
        <p className="text-muted-foreground px-1 text-xs leading-relaxed">
          Optional. It syncs your watchlist across devices and unlocks lists,
          alerts and your stats.
        </p>
      </DrawerSection>
    )
  }

  return (
    <DrawerSection title="Account">
      <div className="border-border/60 bg-muted/40 flex items-center gap-3 rounded-xl border px-3.5 py-3">
        <AccountAvatar name={name} email={email} picture={picture} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name ?? 'Signed in'}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
        </div>
        {pro && (
          <span className="border-primary/40 bg-primary/10 text-primary shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Supporter
          </span>
        )}
      </div>

      {accountMenuFor(pro).map(({ href, label, Icon }) => (
        <DrawerAction
          key={href}
          Icon={Icon}
          label={label}
          href={href}
          onClick={onNavigate}
        />
      ))}

      <DrawerAction
        Icon={LogOut}
        label="Sign out"
        onClick={() => {
          onNavigate()
          void signOut()
        }}
      />
    </DrawerSection>
  )
}
