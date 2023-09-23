import React from 'react'

import { DisclaimerContent } from '@/components/disclaimer-content'
import DisclaimerModal from '@/components/disclaimer-modal'

function Disclaimer() {
  return (
    <DisclaimerModal>
      <DisclaimerContent isHideHeader />
    </DisclaimerModal>
  )
}

export default Disclaimer
