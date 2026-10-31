import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  forgetPage,
  isBackPending,
  leaveLanding,
  markBack,
  rememberPage,
  rememberSlide,
  restoredRail,
  restoredScroll,
  restoredSlide,
  RETURNING_SCRIPT,
  settleBack,
} from '@/lib/back-restore'

const HOME = '/'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('location', { pathname: HOME, search: '' })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  vi.stubGlobal('performance', {
    getEntriesByType: () => [{ type: 'navigate' }],
  })
  settleBack()
  leaveLanding(false)
})

describe('the wiring a browser test proved', () => {
  const read = (path: string) => readFileSync(path, 'utf8')

  // A place outlives a fresh load in sessionStorage, so the next Back restored a
  // rail offset left over from the visit before.
  it('forgets the old place when the page is opened fresh', () => {
    expect(read('components/back-restore.tsx')).toMatch(
      /if \(arrivedByHistory\(\)\) restoreScroll\(restoredScroll\(\)\)\s+else forgetPage\(\)/
    )
  })

  // Strict Mode runs the effect twice on mount; a first-run flag let the second
  // run forget the place a full-page Back was restoring.
  it('tells a new page by its path, not by a first-run flag', () => {
    expect(read('components/back-restore.tsx')).toContain(
      'if (pathname === lastPath.current) return'
    )
  })

  // Stopping at the first scroll that landed left the page 228px off: a block
  // mounted above, and scroll anchoring moved the page to keep up with it.
  it('keeps answering height changes after the first jump lands', () => {
    expect(read('components/back-restore.tsx')).toContain(
      'new ResizeObserver(() => jumpTo(y))'
    )
  })

  it('brings a scrolled rail back as the real List, posters included', () => {
    expect(read('components/main-page/lazy-rail.tsx')).toContain(
      '() => isBackPending() && restoredRail(title) > 0'
    )
  })

  it('names both twins of a rail, so a static rail is remembered too', () => {
    for (const path of [
      'components/list.tsx',
      'components/main-page/static-rail.tsx',
    ]) {
      expect(read(path)).toContain('data-rail={title}')
    }
  })
})

describe('a full-page Back with no bfcache', () => {
  const landAs = (type: string) =>
    vi.stubGlobal('performance', { getEntriesByType: () => [{ type }] })

  beforeEach(() => {
    rememberPage('/', { y: 900, rails: { Trending: 460 } })
  })

  it('gets its rails back once the page has hydrated', () => {
    landAs('back_forward')
    expect(restoredRail('Trending')).toBe(460)
  })

  it('does not on a fresh load', () => {
    landAs('navigate')
    expect(restoredRail('Trending')).toBe(0)
  })

  it('stops at the first client navigation', () => {
    landAs('back_forward')
    leaveLanding()
    expect(restoredRail('Trending')).toBe(0)
  })

  it('never moves the hero, which the server rendered at slide 1', () => {
    landAs('back_forward')
    rememberSlide(3)
    expect(restoredSlide(10)).toBe(0)
  })

  it('marks the document before anything can animate', () => {
    expect(RETURNING_SCRIPT).toContain('back_forward')
    expect(readFileSync('styles/globals.css', 'utf8')).toMatch(
      /\[data-returning\] \.animate-rise-in \{\s+animation: none;/
    )
    expect(readFileSync('app/layout.tsx', 'utf8')).toContain(
      '__html: RETURNING_SCRIPT'
    )
  })
})

describe('what a page gets back', () => {
  it('restores nothing on a normal visit, however much was saved', () => {
    rememberPage(HOME, { y: 900, rails: { Trending: 700 } })
    rememberSlide(3)
    expect(restoredSlide(10)).toBe(0)
    expect(restoredRail('Trending')).toBe(0)
  })

  it('restores the slide and the rail on back', () => {
    rememberPage(HOME, { y: 900, rails: { Trending: 700 } })
    rememberSlide(3)
    markBack()
    expect(isBackPending()).toBe(true)
    expect(restoredSlide(10)).toBe(3)
    expect(restoredRail('Trending')).toBe(700)
    expect(restoredScroll()).toBe(900)
  })

  it('stops restoring once the back navigation has landed', () => {
    rememberSlide(3)
    markBack()
    settleBack()
    expect(restoredSlide(10)).toBe(0)
  })

  it('starts the hero over when the saved slide is gone from the deck', () => {
    rememberSlide(9)
    markBack()
    expect(restoredSlide(5)).toBe(0)
  })

  it('keeps rails it was not told about', () => {
    rememberPage(HOME, { y: 100, rails: { Trending: 700 } })
    rememberPage(HOME, { y: 200, rails: { Popular: 300 } })
    markBack()
    expect(restoredRail('Trending')).toBe(700)
    expect(restoredRail('Popular')).toBe(300)
    expect(restoredScroll()).toBe(200)
  })

  it('keeps pages apart', () => {
    rememberPage('/movies/1', { y: 400, rails: {} })
    markBack()
    expect(restoredScroll()).toBe(0)
  })

  it('forgets a page entered normally, so its old place cannot come back', () => {
    rememberPage(HOME, { y: 900, rails: { Trending: 700 } })
    forgetPage()
    markBack()
    expect(restoredScroll()).toBe(0)
    expect(restoredRail('Trending')).toBe(0)
  })

  it('survives storage that throws, which private modes do', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(() => rememberSlide(2)).not.toThrow()
    markBack()
    expect(restoredSlide(10)).toBe(0)
  })
})
