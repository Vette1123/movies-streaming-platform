'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, Clock, Home, Search, Tv } from 'lucide-react'

import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'TV', href: '/tv-shows', icon: Tv },
  { label: 'Watchlist', href: '/watchlist', icon: Bookmark },
  { label: 'History', href: '/watch-history', icon: Clock },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-background/90 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1"
            >
              <Icon
                className={cn(
                  'size-5 transition-colors',
                  isActive ? 'text-white' : 'text-white/40'
                )}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-white' : 'text-white/40'
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
