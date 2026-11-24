import { relayHostBucket } from '@/scripts/lib/relay-4xx.mjs'
import { describe, expect, it } from 'vitest'

/**
 * 2026-11-24: relay-host port scans (`relay.reely.space:2096/`) and casino-kit
 * wordlist paths sat in cf:health's "unclassified" column, burying real news.
 */
describe('relayHostBucket', () => {
  it('files an alternate-port probe as a port scan', () => {
    for (const port of [2053, 2083, 2087, 2096, 8443]) {
      expect(relayHostBucket(`relay.reely.space:${port}`, '/')).toMatch(
        /port scan/
      )
    }
    expect(
      relayHostBucket('relay.reely.space:2087', '/public/js/global.js')
    ).toMatch(/port scan/)
  })

  it('keeps the root/favicon rule on the default port', () => {
    expect(relayHostBucket('relay.reely.space', '/')).toMatch(/does not serve/)
    expect(relayHostBucket('play.reely.space:443', '/favicon.ico')).toMatch(
      /does not serve/
    )
  })

  it('files every non-route path on the relay hosts as a wordlist', () => {
    for (const path of [
      '/api/',
      '/api/user/ismustmobile',
      '/apix/tongchengyue/tags',
      '/h5/',
      '/Public/home/wap/css/qdgame.css',
      '/res/duan/tm.png',
      '/kefu/css/style.css',
      '/selftest/x',
    ]) {
      expect(relayHostBucket('relay.reely.space', path)).toMatch(/wordlist/)
    }
  })

  it('leaves the relay real paths unclassified, so a 4xx there is news', () => {
    for (const path of [
      '/health',
      '/selftest',
      '/resolve',
      '/status',
      '/file/abc.mp4',
      '/seg/xyz',
      '/pl/xyz',
    ]) {
      expect(relayHostBucket('relay.reely.space', path)).toBeUndefined()
      expect(relayHostBucket('relay-b.reely.space', path)).toBeUndefined()
    }
  })

  it('leaves the player paths to the other buckets', () => {
    expect(relayHostBucket('play.reely.space', '/h5/')).toBeUndefined()
  })

  it('never claims the main site', () => {
    expect(relayHostBucket('www.reely.space', '/api/')).toBeUndefined()
    expect(relayHostBucket('www.reely.space:2096', '/')).toBeUndefined()
    expect(relayHostBucket(undefined, '/')).toBeUndefined()
  })
})
