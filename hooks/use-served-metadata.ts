'use client'

import { useEffect } from 'react'

import { siteConfig } from '@/config/site'
import { docTitle } from '@/lib/seo-title'

/**
 * Put back the head the Worker wrote, after React has hydrated over it.
 *
 * The fallback shells are served under a URL they do not own: the Worker takes
 * `/media-fallback.html` and streams it as `/movies/<id>` with the real title,
 * description, canonical, OG tags and `index, follow` injected into the head.
 * Then the page hydrates — and React re-renders the head from the SHELL's own
 * metadata, which is the root layout's defaults plus the shell layout's
 * `noindex, nofollow`. Everything the Worker wrote is gone by the time the page
 * is interactive.
 *
 * Googlebot renders JavaScript. What it files is the head AFTER that render, so
 * every tail page looked like: `noindex, nofollow`, canonical pointing at the
 * homepage, and the site's generic description. Search Console said so —
 * 9,274 "Excluded by 'noindex' tag", 6,961 "Duplicate without user-selected
 * canonical" and 10,203 "Crawled - currently not indexed", against ~13,900 tail
 * URLs and climbing from the week the shells shipped.
 *
 * Each shell used to patch `document.title` alone, for the same reason and with
 * the same one-line comment, four times over. This is that fix for the whole
 * head, in one place.
 *
 * Direct DOM writes, in an effect: measured on production, React does not
 * re-assert its own head tags after the first render, so what is written here
 * stays written.
 */
export interface ServedMetadata {
  /** Also the <title>. */
  title: string
  description?: string
  /** Absolute URL. */
  image?: string
  /** og:type — 'video.movie', 'profile', 'website'… */
  ogType?: string
  /**
   * False for a page that genuinely must not be indexed. The default is true:
   * these pages are as real as the prerendered ones, which is the whole reason
   * the Worker writes `index, follow` in the first place.
   */
  indexable?: boolean
}

type Attr = 'content' | 'href'

const upsert = (
  selector: string,
  create: () => HTMLElement,
  attribute: Attr,
  value?: string
) => {
  if (!value) return
  const existing = document.head.querySelector(selector)
  const element = existing ?? document.head.appendChild(create())
  element.setAttribute(attribute, value)
}

const named = (name: string, value?: string) =>
  upsert(
    `meta[name="${name}"]`,
    () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', name)
      return meta
    },
    'content',
    value
  )

const property = (name: string, value?: string) =>
  upsert(
    `meta[property="${name}"]`,
    () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', name)
      return meta
    },
    'content',
    value
  )

/** The URL as served, without a query string or a trailing slash. */
const canonicalOf = () =>
  `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`

/**
 * Drop the JSON-LD React emitted a second time.
 *
 * The shells are prerendered with the root layout's WebSite and Organization
 * blocks already in the HTML. Hydration re-renders that layout and React
 * APPENDS its head scripts rather than matching the ones already there, so a
 * tail page ends up publishing WebSite and Organization twice — measured on
 * production: five ld+json blocks where the prerendered twin has four.
 *
 * Deduped on the serialized text, not on `@type`: what React repeats is a
 * byte-identical copy of a block the shell already carried, while the Worker's
 * own block (the Movie/TVSeries entity plus its breadcrumb) is unique and has
 * to survive. Comparing text keeps that distinction without parsing anything.
 */
const dedupeJsonLd = () => {
  const seen = new Set<string>()
  document
    .querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
    .forEach((script) => {
      const body = (script.textContent || '').trim()
      if (!body) return
      if (seen.has(body)) script.remove()
      else seen.add(body)
    })
}

export function useServedMetadata(meta: ServedMetadata | null): void {
  const { title, description, image, ogType, indexable } = meta ?? {}

  useEffect(() => {
    if (!title) return
    const heading = title
    const canonical = canonicalOf()

    // The tab and the SERP title carry the site name; og:title and
    // twitter:title below do not — that is what the prerendered pages do.
    document.title = docTitle(heading)
    named('robots', indexable === false ? 'noindex, nofollow' : 'index, follow')
    named('description', description)
    upsert(
      'link[rel="canonical"]',
      () => {
        const link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        return link
      },
      'href',
      canonical
    )

    property('og:title', heading)
    property('og:description', description)
    property('og:url', canonical)
    property('og:type', ogType || 'website')
    property('og:site_name', siteConfig.name)
    property('og:image', image)
    named('twitter:title', heading)
    named('twitter:description', description)
    named('twitter:image', image)
    dedupeJsonLd()
  }, [description, image, indexable, ogType, title])
}
