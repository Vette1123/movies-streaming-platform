import React from 'react'
import { Metadata } from 'next'

// Same reasoning as app/media-fallback/layout.tsx: cloudflare/worker.js serves
// this route's HTML under /collection/<id>, so the bare URL is an empty shell
// that must not compete in the index with the real collection URLs.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CollectionFallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
