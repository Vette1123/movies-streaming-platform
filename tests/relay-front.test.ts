import { describe, expect, it } from 'vitest'

import { toPublic } from '../workers/relay-front/worker.mjs'

const pair = {
  origin: 'https://origin-b.reely.space',
  public: 'https://relay-b.reely.space',
}

describe('relay front host rewrite', () => {
  it('rewrites the http origin a tunnelled VM relay stamps', () => {
    const body =
      '{"sources":[{"url":"http://origin-b.reely.space/file/k?u=x"}]}'
    expect(toPublic(body, pair)).toBe(
      '{"sources":[{"url":"https://relay-b.reely.space/file/k?u=x"}]}'
    )
  })

  it('rewrites the https origin a Netlify relay stamps', () => {
    expect(toPublic('https://origin-b.reely.space/pl/k', pair)).toBe(
      'https://relay-b.reely.space/pl/k'
    )
  })

  it('leaves other hosts alone', () => {
    const vault = 'https://cacdn.hakunaymatata.com/x.srt'
    expect(toPublic(vault, pair)).toBe(vault)
  })
})
