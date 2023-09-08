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

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isBrowser])

  return { isShowNavBackground }
}
