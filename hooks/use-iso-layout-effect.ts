import React from 'react'

// useLayoutEffect on the server is a no-op that React warns about, and these
// effects only have meaning once there's a DOM to measure.
export const useIsoLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
