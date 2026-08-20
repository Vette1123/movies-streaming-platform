'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { getJson } from '@/lib/api-client'
import type { PublicProfile } from '@/lib/profile/routes'
import { useLocationPathname } from '@/hooks/use-location-pathname'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicProfileView } from '@/components/profile/public-profile-view'

// The shell for /u/<handle>. There is no prerendered page for a profile —
// handles are claimed after the build, by people — so the Worker always answers
// this route, injecting the real title, description, OG tags and JSON-LD into
// this page's exported HTML (see handleProfilePage in cloudflare/worker.js)
// before the client fetches the rest to draw.

const parseHandle = (pathname: string): string | null =>
  pathname.match(/^\/u\/([a-z0-9-]{3,20})/)?.[1] ?? null

export default function ProfileFallbackPage() {
  const pathname = useLocationPathname()
  const handle = React.useMemo(() => parseHandle(pathname), [pathname])

  const { data, isError } = useQuery<PublicProfile>({
    queryKey: ['public-profile', handle],
    enabled: Boolean(handle),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const body = await getJson<{
        success?: boolean
        profile?: PublicProfile
      }>(`/api/profile/${handle}`)
      if (!body?.success || !body.profile) throw new Error('profile missing')
      return body.profile
    },
  })

  // The Worker injects the real <title>, but hydration re-renders the shell's
  // own — without this the tab reverts to the generic site title.
  React.useEffect(() => {
    if (data) document.title = `${data.name || data.handle} on Reely`
  }, [data])

  if (isError) {
    return (
      <div className="container flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nobody here by that name
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          The page was made private, or the link is wrong. A profile can be
          taken down by the person who made it at any time.
        </p>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Go to Reely
        </Link>
      </div>
    )
  }

  if (!data) return <ProfileSkeleton />

  return <PublicProfileView profile={data} />
}

/** Holds the settled shape of the page above, so nothing moves when it lands. */
function ProfileSkeleton() {
  return (
    <div aria-hidden className="container max-w-5xl py-20 lg:py-28">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Skeleton className="size-24 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-56 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-24 w-full rounded-lg"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <Skeleton className="mt-14 h-4 w-40" />
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            className="aspect-2/3 w-full rounded-lg"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
