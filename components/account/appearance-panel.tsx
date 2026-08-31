'use client'

import { useEffect } from 'react'

import { savePrefs } from '@/lib/account'
import { ACCENTS, applyAppearance, DENSITIES } from '@/lib/appearance'
import { useAccount } from '@/hooks/use-account'

import { ChoiceChips, SettingGroup, SettingRow } from './controls'
import { SupporterGate } from './supporter-gate'

export function AppearancePanel() {
  const { pro, prefs } = useAccount()
  const accent = prefs.accent ?? 'default'
  const density = prefs.density ?? 'comfortable'

  // Server state wins over whatever the pre-paint script read from the cache —
  // which matters on a device where the accent was changed somewhere else.
  useEffect(() => {
    if (!pro) return
    applyAppearance(accent, density)
  }, [accent, density, pro])

  if (!pro) {
    return (
      <SupporterGate title="Make it yours">
        Six accent palettes and a denser layout, applied everywhere on every
        device you sign in on. It is the smallest thing on this page and the one
        you will see every single session.
      </SupporterGate>
    )
  }

  return (
    <SettingGroup>
      <SettingRow
        label="Accent"
        description="The colour on every button, link and highlight. It is applied before the first paint, so it is already yours on the next page you open."
      >
        <ChoiceChips
          ariaLabel="Accent"
          options={ACCENTS}
          value={accent}
          onSelect={(id) => {
            applyAppearance(id, density)
            void savePrefs({ accent: id })
          }}
        />
      </SettingRow>

      <SettingRow
        label="Layout"
        description="Compact fits about one more poster per row and tightens everything to match. It is a change to the whole site, not just this page."
      >
        <ChoiceChips
          ariaLabel="Layout"
          options={DENSITIES}
          value={density}
          onSelect={(id) => {
            applyAppearance(accent, id)
            void savePrefs({ density: id })
          }}
        />
      </SettingRow>
    </SettingGroup>
  )
}
