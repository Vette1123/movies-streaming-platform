import React from 'react'

import { TOP_OFFSET } from '@/lib/constants'

export const useNavbarScrollOverlay = () => {
  const [isShowNavBackground, setIsShowNavBackground] = React.useState(false)
  const isBrowser = typeof window !== 'undefined'

  React.useEffect(() => {
    const handleScroll = () => {
      if (isBrowser && window.scrollY >= TOP_OFFSET) {
        setIsShowNavBackground(true)
      } else {
        setIsShowNavBackground(false)
      }
    }

    // Passive: this handler never calls preventDefault, and without the flag
    // the browser waits on it before it can scroll.
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isBrowser])

  return { isShowNavBackground }
}
