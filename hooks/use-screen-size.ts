'use client'

import { useEffect, useState } from 'react'

export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (screenSize.width >= 1024) {
    return 'lg'
  } else if (screenSize.width >= 768) {
    return 'md'
  } else {
    return 'sm'
  }
}
