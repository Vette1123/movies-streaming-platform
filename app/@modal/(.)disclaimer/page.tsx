import React from 'react'

import { DisclaimerContent } from '@/components/disclaimer/disclaimer-content'
import DisclaimerModal from '@/components/disclaimer/disclaimer-modal'

function Disclaimer() {
  return (
    <DisclaimerModal>
      <DisclaimerContent isHideHeader />
    </DisclaimerModal>
  )
}

export default Disclaimer
