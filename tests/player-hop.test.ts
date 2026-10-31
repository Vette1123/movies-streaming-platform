import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  incidentFrom,
  isViewerChoice,
  mayLeavePlayer,
  playbackAdvanced,
} from '@/lib/player-hop'

const source = (file: string) =>
  readFileSync(path.resolve(__dirname, '..', file), 'utf8')

describe('leaving the house player', () => {
  it('hops off a stream that never started', () => {
    expect(mayLeavePlayer({ sawPlayback: false, viewerChose: false })).toBe(
      true
    )
  })

  it('never moves somebody off a stream that has played', () => {
    expect(mayLeavePlayer({ sawPlayback: true, viewerChose: false })).toBe(
      false
    )
  })

  it('lets the viewer leave whenever they ask', () => {
    expect(mayLeavePlayer({ sawPlayback: true, viewerChose: true })).toBe(true)
  })

  it('counts moving progress as playback, not a resume position', () => {
    expect(playbackAdvanced(undefined, 540)).toBe(false)
    expect(playbackAdvanced(540, 540)).toBe(false)
    expect(playbackAdvanced(540, 545)).toBe(true)
  })

  it('keeps the guard in front of the hop', () => {
    const player = source('components/player/reely-player.tsx')
    const guard = player.indexOf('mayLeavePlayer({')
    const hop = player.indexOf('unavailableRef.current(')
    expect(guard).toBeGreaterThan(-1)
    expect(hop).toBeGreaterThan(guard)
  })

  it('counts a stuck viewer as a failure, for the tripwire', () => {
    const player = source('components/player/reely-player.tsx')
    expect(player).toMatch(/incident\?\.step === 'stuck'/)
    expect(player).toMatch(/reason: 'stuck'/)
  })

  it('saves a viewer choice as a choice, not as a stall', () => {
    const player = source('components/player/reely-player.tsx')
    expect(player).toMatch(/viewerChose \? 'switcher' : 'stall_auto'/)
  })
})

describe('saving a server', () => {
  it('saves what the viewer picked and nothing automatic', () => {
    expect(isViewerChoice('switcher')).toBe(true)
    expect(isViewerChoice('stall_auto')).toBe(false)
  })

  it('stops an automatic hop before any write', () => {
    const hook = source('hooks/use-stream-source.ts')
    const guard = hook.indexOf('if (!isViewerChoice(via))')
    expect(guard).toBeGreaterThan(-1)
    for (const write of [
      'writeJson(BY_TITLE_KEY',
      'writeJson(DEVICE_KEY',
      'savePrefs({ source',
    ]) {
      expect(hook.indexOf(write)).toBeGreaterThan(guard)
    }
  })
})

describe('incident reports', () => {
  it('keeps the fields a failure is diagnosed from', () => {
    expect(
      incidentFrom({
        step: 'reload',
        hls_type: 'networkError',
        hls_details: 'fragLoadError',
        http_status: 403,
        played: true,
        position_s: 528.4,
        buffer_s: 0.2,
        attempt: 1,
        online: true,
      })
    ).toEqual({
      step: 'reload',
      hls_type: 'networkError',
      hls_details: 'fragLoadError',
      http_status: 403,
      played: true,
      position_s: 528,
      buffer_s: 0,
      attempt: 1,
      online: true,
    })
  })

  it('refuses an unknown step', () => {
    expect(incidentFrom({ step: 'anything' })).toBeNull()
  })

  it('drops anything shaped like a URL', () => {
    const incident = incidentFrom({
      step: 'retry',
      hls_details: 'https://cdn.example/seg.ts?token=abc',
    })
    expect(incident?.hls_details).toBeUndefined()
  })
})
