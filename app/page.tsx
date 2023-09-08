import React, { Suspense } from 'react'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { HeroSlider } from '@/components/header/hero-slider'
import { List } from '@/components/list'

async function IndexPage() {
  return (
    <section className="h-full">
      <Suspense
        fallback={<div className="h-screen bg-red-800">Loading...</div>}
      >
        <HeroSlider />
      </Suspense>
      <List />
    </section>
  )
}
export default IndexPage
