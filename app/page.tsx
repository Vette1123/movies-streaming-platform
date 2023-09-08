import React, { Suspense } from 'react'

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
