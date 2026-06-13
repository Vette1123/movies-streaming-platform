// Load Inter glyphs from Google Fonts at runtime.
//
// `readFile(process.cwd(), ...)` and `fetch(new URL(..., import.meta.url))`
// both break on Cloudflare Workers: cwd is `/`, the project filesystem isn't
// in the worker bundle, and Next.js's prerender undici doesn't implement
// file:// fetch. Google Fonts CSS API works in every runtime — Node build,
// Turbopack prerender, and the Cloudflare Worker — using standard fetch
// with public URLs.

export async function loadInter(
  weight: 700 | 900,
  text: string
): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(text)}`
  const cssRes = await fetch(cssUrl)
  if (!cssRes.ok) {
    throw new Error(`Failed to fetch Inter ${weight} CSS: ${cssRes.status}`)
  }
  const css = await cssRes.text()
  const match = css.match(/src: url\((https:\/\/[^)]+)\)/)
  if (!match) {
    throw new Error(`Could not extract font URL for Inter ${weight}`)
  }
  const fontRes = await fetch(match[1])
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch Inter ${weight} file: ${fontRes.status}`)
  }
  return fontRes.arrayBuffer()
}
