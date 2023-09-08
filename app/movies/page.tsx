import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Movies List',
}

function Movies() {
  return <section className="h-full">Movies</section>
}

export default Movies
