import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { withSiteSocial } from '@/lib/page-metadata'

// Next replaces openGraph/twitter wholesale instead of merging them with the
// root layout's. Pages with their own openGraph shipped without og:site_name or
// og:locale, and a page with no twitter block unfurled on X with the HOME
// page's title and description.
describe('withSiteSocial', () => {
  const meta = withSiteSocial({
    title: 'Support',
    openGraph: { title: 'Support Reely', description: 'd', url: '/support' },
  })

  it('fills the site-wide openGraph fields', () => {
    expect(meta.openGraph).toMatchObject({
      siteName: 'Reely',
      locale: 'en_US',
      type: 'website',
      images: '/opengraph-image.png',
    })
  })

  it("gives twitter the page's own title, not the home page's", () => {
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Support Reely',
      description: 'd',
      images: ['/opengraph-image.png'],
    })
  })

  it('keeps what a page sets explicitly', () => {
    const person = withSiteSocial({
      openGraph: {
        type: 'profile',
        title: 'Brad Pitt on Reely',
        images: [{ url: 'https://x/p.jpg', width: 500, height: 750 }],
      },
      twitter: { card: 'summary' },
    })
    expect(person.openGraph).toMatchObject({ type: 'profile' })
    expect(person.twitter).toMatchObject({
      card: 'summary',
      title: 'Brad Pitt on Reely',
      images: ['https://x/p.jpg'],
    })
  })

  it('wraps every page that sets openGraph', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.tsx?$/.test(name)) files.push(path)
      }
    }
    walk('app')
    walk('components')
    const offenders = files.filter((file) => {
      if (file === join('app', 'layout.tsx')) return false
      const src = readFileSync(file, 'utf8')
      return /\bopenGraph:/.test(src) && !src.includes('withSiteSocial(')
    })
    expect(offenders).toEqual([])
  })
})
