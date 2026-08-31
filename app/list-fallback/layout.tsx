import React from 'react'

// An implementation detail of the static export: cloudflare/worker.js serves
// this route's exported HTML under /l/<slug>, rewriting the <head> as it goes.
//
// It carries NO `noindex` metadata, deliberately. A meta tag travels with the
// body, and this body is served under those real URLs — the Worker strips the
// tag out of what it streams, but React puts it back on hydration from this
// route's own metadata, and Googlebot renders JS. That is how 9,274 real
// pages ended up in Search Console under "Excluded by 'noindex' tag". The
// bare URL is kept out of the index by robots.txt and by the X-Robots-Tag in
// public/_headers, both of which apply to the URL and not to the body.

export default function ListFallbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
