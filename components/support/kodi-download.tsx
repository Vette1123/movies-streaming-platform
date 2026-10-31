'use client'

import { Download } from 'lucide-react'

import { trackFeatureUsed } from '@/lib/analytics'
import { buttonVariants } from '@/components/ui/button'

export function KodiDownload({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      onClick={() =>
        trackFeatureUsed({ feature: 'tv_link', action: 'download' })
      }
      className={buttonVariants({ size: 'lg' })}
    >
      <Download className="mr-2 size-4" />
      Download the add-on
    </a>
  )
}
