import React, { Suspense } from 'react'
import Image from 'next/image'

import { apiConfig } from '@/lib/tmdbConfig'
import { HeroSlider } from '@/components/header/hero-slider'

async function IndexPage() {
  return (
    <section>
      <div className="isolate">
        <Suspense
          fallback={
            <div className="h-screen bg-red-800 w-screen">Loading...</div>
          }
        >
          <HeroSlider />
        </Suspense>
        {/* <div>hiii</div>
        <div>hiii</div>
        <div>hiii</div>
        <div>hiii</div>
        <div>hiii</div> */}
      </div>
    </section>
  )
}
export default IndexPage
