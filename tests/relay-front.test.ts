import { describe, expect, it } from 'vitest'

import { toPublic } from '../workers/relay-front/worker.mjs'

const tunnelled = {
  origin: 'https://origin-b.reely.space',
  public: 'https://relay.reely.space',
}

const netlify = {
  origin: 'https://reely-relay-b2.netlify.app',
  public: 'https://relay-b.reely.space',
}

describe('relay front host rewrite', () => {
  it('rewrites the http origin a tunnelled VM relay stamps', () => {
    const body =
      '{"sources":[{"url":"http://origin-b.reely.space/file/k?u=x"}]}'
    expect(toPublic(body, tunnelled)).toBe(
      '{"sources":[{"url":"https://relay.reely.space/file/k?u=x"}]}'
    )
  })

  it('rewrites the https origin a tunnelled VM relay stamps', () => {
    expect(toPublic('https://origin-b.reely.space/pl/k', tunnelled)).toBe(
      'https://relay.reely.space/pl/k'
    )
  })

  it('rewrites the Netlify fallback origin', () => {
    expect(toPublic('https://reely-relay-b2.netlify.app/file/k', netlify)).toBe(
      'https://relay-b.reely.space/file/k'
    )
  })

  it('leaves other hosts alone', () => {
    const vault = 'https://cacdn.hakunaymatata.com/x.srt'
    expect(toPublic(vault, tunnelled)).toBe(vault)
  })
})
