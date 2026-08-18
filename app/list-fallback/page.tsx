'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { getJson } from '@/lib/api-client'
import type { PublicList } from '@/lib/lists/routes'
import { useLocationPathname } from '@/hooks/use-location-pathname'
import { buttonVariants } from '@/components/ui/button'
import { PublicListView } from '@/components/lists/public-list-view'

// The shell for /l/<slug>. There is no prerendered page for a published list —
// lists are created after the build, by people — so the Worker always answers
// this route, injecting the real title, description, OG tags and JSON-LD into
// this page's exported HTML (see handleListPage in cloudflare/worker.js) before
// the client fetches the items to draw.

const parseSlug = (pathname: string): string | null =>
  pathname.match(/^\/l\/([A-Za-z0-9-]{1,64})/)?.[1] ?? null

export default function ListFallbackPage() {
  const pathname = useLocationPathname()
  const slug = React.useMemo(() => parseSlug(pathname), [pathname])

  const { data, isError } = useQuery<PublicList>({
    queryKey: ['public-list', slug],
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const body = await getJson<{ success?: boolean; list?: PublicList }>(
        `/api/list/${slug}`
      )
      if (!body?.success || !body.list) throw new Error('list missing')
      return body.list
    },
  })

  // The Worker injects the real <title>, but hydration re-renders the shell's
  // own — without this the tab reverts to the generic site title.
  React.useEffect(() => {
    if (data?.name) document.title = data.name
  }, [data])

  if (isError) {
    return (
      <div className="container flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This list is not here
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          It was unpublished, or the link is wrong. Lists can be taken down by
          the person who made them at any time.
        </p>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Go to Reely
        </Link>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container max-w-6xl py-20 lg:py-28">
        <div className="bg-muted/30 mb-10 h-10 w-2/3 max-w-md animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="bg-muted/30 aspect-2/3 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    )
  }

  return <PublicListView list={data} />
}
