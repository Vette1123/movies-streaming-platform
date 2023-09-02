import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Movies List',
}

function Movies() {
  return <div className="container max-w-screen-2xl pt-20">Movies</div>
}

export default Movies
