'use client'

import { useEffect, useState } from 'react'

interface ScreenSize {
  width: number
  height: number
}

const useScreenSize = (): ScreenSize => {
  const isBrowser = typeof window !== 'undefined'

  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: isBrowser ? window.innerWidth : 0,
    height: isBrowser ? window.innerHeight : 0,
  })

  useEffect(() => {
    if (!isBrowser) {
      return // Skip useEffect on the server
    }

    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isBrowser])

  return screenSize
}

export default useScreenSize
