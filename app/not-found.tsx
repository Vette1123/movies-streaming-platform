import React from 'react'
import Link from 'next/link'
import { Film } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex size-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
        <Film className="size-10 text-white/40" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h1 className="bg-gradient-to-br from-white via-white/80 to-white/20 bg-clip-text text-8xl font-bold tracking-tight text-transparent">
          404
        </h1>
        <p className="text-xl font-medium">Page not found</p>
        <p className="text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: 'default' }))}>
          Go Home
        </Link>
        <Link
          href="/movies"
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Browse Movies
        </Link>
      </div>
    </main>
  )
}
