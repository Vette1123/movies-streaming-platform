import type { Metadata } from 'next'

import { NotFoundContent } from '@/components/not-found-content'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return <NotFoundContent />
}
