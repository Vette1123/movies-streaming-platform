'use client'

import { Heart, RefreshCw, Sparkles } from 'lucide-react'

import { useAccountIdentity } from '@/hooks/use-account'
import { SupporterGate } from '@/components/account/supporter-gate'

/**
 * Named here rather than passed in. Every caller is a Server Component, and a
 * component is a function — handing one across that boundary as a prop is not
 * serialisable and throws the page straight into its error boundary. A string
 * key crosses fine.
 */
const PROMPT_ICONS = {
  heart: Heart,
  sync: RefreshCw,
  stats: Sparkles,
} as const

/**
 * A support pitch on a page whose feature is free — shown to everyone except
 * the people who have already paid for it.
 *
 * The same panel as `SupporterGate`, which is deliberate: somebody who meets
 * this on the watchlist and then again on a locked account panel should be
 * looking at one recognisable thing, not two designs for the same offer. The
 * only difference is who it is for. A gate stands in for a feature the visitor
 * cannot use; this stands beside one they can, and says what paying would add.
 *
 * It renders nothing until the browser knows who is looking, so the static HTML
 * never ships a pitch to a supporter, and nothing above it moves when the answer
 * arrives — every use is the last thing on its page.
 */
export function SupportPrompt({
  icon = 'heart',
  ...props
}: Omit<React.ComponentProps<typeof SupporterGate>, 'Icon'> & {
  icon?: keyof typeof PROMPT_ICONS
}) {
  const { ready, pro } = useAccountIdentity()
  if (!ready || pro) return null
  return <SupporterGate {...props} Icon={PROMPT_ICONS[icon]} />
}
