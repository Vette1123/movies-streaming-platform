import { MessageSquarePlus } from 'lucide-react'

import { supportMailto } from '@/config/support'
import { FEATURE_PROMISE } from '@/config/support-features'
import { buttonVariants } from '@/components/ui/button'

/** The promise, once, for the page selling it and the panel of who bought it. */
export function FeaturePromise() {
  return (
    <div className="grid gap-6 border-y border-primary/30 py-10 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
      <h2 className="max-w-[20ch] text-4xl font-bold tracking-tighter text-balance md:text-5xl">
        {FEATURE_PROMISE.title}
      </h2>
      <div className="space-y-5">
        <p className="max-w-[52ch] leading-relaxed text-muted-foreground">
          {FEATURE_PROMISE.body}
        </p>
        <a
          href={supportMailto(FEATURE_PROMISE.mailSubject)}
          className={buttonVariants({ size: 'lg' })}
        >
          <MessageSquarePlus className="mr-2 size-4" />
          {FEATURE_PROMISE.action}
        </a>
      </div>
    </div>
  )
}
