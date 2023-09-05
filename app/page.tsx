import React, { Suspense } from 'react'

import { HeroSlider } from '@/components/header/hero-slider'

async function IndexPage() {
  return (
    <section className="h-full">
      <Suspense
        fallback={<div className="h-screen bg-red-800">Loading...</div>}
      >
        <HeroSlider />
      </Suspense>
    </section>
  )
}
export default IndexPage
