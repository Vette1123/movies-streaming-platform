import React from 'react'
import { Metadata } from 'next'

// Same reasoning as app/list-fallback/layout.tsx: cloudflare/worker.js serves
// this route's exported HTML under /u/<handle>, so the bare URL is an empty
// shell that must not compete in the index with the real profile URLs.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ProfileFallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
