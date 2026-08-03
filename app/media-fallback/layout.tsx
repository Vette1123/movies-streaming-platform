import React from 'react'
import { Metadata } from 'next'

// This route is an implementation detail: cloudflare/worker.js serves its
// exported HTML under /movies/<id> and /tv-shows/<id> for ids the build did not
// prerender, rewriting the <head> as it goes. The bare /media-fallback URL shows
// an empty shell, so keep it out of the index — the real detail URLs are what
// should rank, and the Worker gives those a proper canonical.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function MediaFallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
