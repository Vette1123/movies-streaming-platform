import { continueRender, delayRender, staticFile } from 'remotion'

/** Inter at the weights the share card uses (app/_fonts). Every frame waits for all three. */
const WEIGHTS = [500, 700, 900] as const

let loading: Promise<void> | null = null

export function loadFonts() {
  if (loading) return loading
  const handle = delayRender('Inter')
  loading = Promise.all(
    WEIGHTS.map(async (weight) => {
      const face = new FontFace(
        'Inter',
        `url(${staticFile(`fonts/Inter-${weight}.ttf`)})`,
        { weight: String(weight) }
      )
      document.fonts.add(await face.load())
    })
  ).then(() => continueRender(handle))
  return loading
}
