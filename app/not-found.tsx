import type { Metadata } from 'next'

import { shellMetadata } from '@/lib/shell-metadata'
import { NotFoundContent } from '@/components/not-found-content'

// Served under every unknown URL, so the root layout's homepage canonical made
// thousands of 404s claim to be copies of `/` (Bing, 2026-11-06). Drop it.
export const metadata: Metadata = {
  ...shellMetadata,
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <NotFoundContent />
}
