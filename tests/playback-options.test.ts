import { describe, expect, it } from 'vitest'

import { normalisePrefs } from '@/lib/auth/routes'
import {
  playerParams,
  subtitlePreviewStyle,
  validPlaybackPrefs,
} from '@/lib/playback-options'

// Written for the bug that made these necessary: the account route kept only
// `sub` and `subSize`, so every other option looked saved and never synced.

const everything = {
  sub: 'ar',
  subSize: 'l',
  subColor: 'yellow',
  subBack: 'none',
  miniBar: false,
  quality: 1080,
  audio: 'it',
  fit: '16:9',
  brightness: 1.2,
  boost: 2,
  night: true,
}

describe('validPlaybackPrefs', () => {
  it('keeps every field a player or a panel can set', () => {
    expect(validPlaybackPrefs(everything)).toEqual(everything)
  })

  it('drops anything outside the closed sets', () => {
    expect(
      validPlaybackPrefs({
        sub: '<script>',
        subSize: 'xl',
        subColor: 'red;background:url(x)',
        subBack: 'blur',
        miniBar: 'yes',
        quality: 881,
        audio: 'Italian',
        fit: 'stretch',
        brightness: 9,
        boost: '2',
        night: 1,
        anythingElse: 'x',
      })
    ).toEqual({})
  })

  it('answers nothing for what is not an object', () => {
    expect(validPlaybackPrefs(null)).toEqual({})
    expect(validPlaybackPrefs('sub=ar')).toEqual({})
    expect(validPlaybackPrefs([everything])).toEqual({})
  })

  it('keeps a three-letter language, which the player accepts', () => {
    expect(validPlaybackPrefs({ sub: 'fil' })).toEqual({ sub: 'fil' })
  })
})

describe('playerParams', () => {
  it('spells every option the way the player reads it', () => {
    expect(Object.fromEntries(playerParams(everything))).toEqual({
      sub: 'ar',
      subs: 'l',
      subc: 'yellow',
      subb: 'none',
      q: '1080',
      al: 'it',
      fit: '16:9',
      br: '1.2',
      boost: '2',
      mini: '0',
      nm: '1',
    })
  })

  it('sends nothing for an option nobody chose', () => {
    expect(playerParams({})).toEqual([])
    expect(playerParams(undefined)).toEqual([])
  })

  it('sends an explicit off, so the account beats a device copy', () => {
    expect(Object.fromEntries(playerParams({ night: false }))).toEqual({
      nm: '0',
    })
  })
})

describe('auto skip', () => {
  it('travels both ways on the ticket, and only as a boolean', () => {
    expect(Object.fromEntries(playerParams({ autoSkip: true }))).toEqual({
      as: '1',
    })
    expect(Object.fromEntries(playerParams({ autoSkip: false }))).toEqual({
      as: '0',
    })
    expect(playerParams({ autoSkip: 'yes' })).toEqual([])
  })

  it('survives the account route', () => {
    expect(normalisePrefs({ playback: { autoSkip: true } })?.playback).toEqual({
      autoSkip: true,
    })
  })
})

describe('the account route', () => {
  it('saves every option, not just the subtitle pair', () => {
    expect(normalisePrefs({ playback: everything })?.playback).toEqual(
      everything
    )
  })

  it('leaves playback out when nothing in it is valid', () => {
    expect(normalisePrefs({ playback: { fit: 'stretch' } })).not.toHaveProperty(
      'playback'
    )
  })
})

describe('subtitlePreviewStyle', () => {
  it('matches the player with nothing chosen', () => {
    expect(subtitlePreviewStyle({})).toMatchObject({
      fontSize: '1rem',
      color: '#ffffff',
      background: 'rgba(0, 0, 0, 0.75)',
    })
  })

  it('leaves outline text a shadow to stand on', () => {
    const style = subtitlePreviewStyle({ subBack: 'none', subSize: 'l' })
    expect(style.background).toBe('transparent')
    expect(style.textShadow).not.toBe('none')
    expect(style.fontSize).toBe('1.3rem')
  })
})
