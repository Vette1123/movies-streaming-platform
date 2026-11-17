/**
 * Field diagnostics for slow taps. PostHog's INP attribution says how long a
 * tap took but drops the long-animation-frame scripts behind it, and loses the
 * element when the tap removes it (the Paste chip unmounts once a link fills
 * the field). On 17 Nov the slowest mobile taps on `/` spent up to 2,000 ms in
 * handlers with 4 ms of paint, while the lab (`pnpm inp:flow`) measured 12 ms.
 * This names, for each tap over SLOW_MS: the element, how long after load,
 * whether the page was hidden meanwhile (an OS sheet, the clipboard prompt, an
 * app switch), and the scripts that held the main thread.
 *
 * ponytail: up to MAX_REPORTS per page, so a broken phone cannot flood the
 * project; raise it only if the field sample is too thin to name a cause.
 */

export const SLOW_MS = 500
export const MAX_REPORTS = 3

export type TargetShape = {
  tagName: string
  id?: string
  className?: unknown
}

export type EventTiming = {
  name: string
  startTime: number
  duration: number
  processingStart: number
  processingEnd: number
}

export type FrameScript = {
  invoker?: string
  sourceURL?: string
  sourceFunctionName?: string
  duration: number
  forcedStyleAndLayoutDuration?: number
}

export type Frame = {
  startTime: number
  duration: number
  scripts?: readonly FrameScript[]
}

export type SlowInteractionProps = {
  interaction: string
  duration_ms: number
  input_delay_ms: number
  processing_ms: number
  presentation_ms: number
  target: string
  since_load_s: number
  hidden: boolean
  frames: number
  script_ms: number
  forced_layout_ms: number
  top_scripts: string[]
}

/** `button#id` or `button.first.two.classes`: a selector, never text. */
export function describeTarget(el: TargetShape | null | undefined): string {
  if (!el?.tagName) return ''
  const tag = el.tagName.toLowerCase()
  if (el.id) return `${tag}#${el.id}`
  const classes =
    typeof el.className === 'string'
      ? el.className.split(/\s+/).filter(Boolean).slice(0, 3)
      : []
  return [tag, ...classes].join('.')
}

/**
 * A script URL reduced to its file name; another site's keeps its host, and a
 * non-web scheme (an extension) keeps only the scheme. No query strings.
 */
export function scriptSource(url: string | undefined, origin: string): string {
  if (!url) return ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ''
  }
  if (!/^https?:$/.test(parsed.protocol))
    return parsed.protocol.replace(':', '')
  const file = parsed.pathname.split('/').pop() || '/'
  if (parsed.origin === origin) return file
  return `${parsed.host}/${file}`
}

/** URLs inside an invoker ("https://…/x.js", "IMG#a.onload") reduced the same way. */
function cleanInvoker(invoker: string | undefined, origin: string): string {
  if (!invoker) return ''
  return invoker.replace(/\b[a-z-]+:\/\/[^\s)]+/gi, (url) =>
    scriptSource(url, origin)
  )
}

function describeScript(script: FrameScript, origin: string): string {
  const where = scriptSource(script.sourceURL, origin)
  const fn = script.sourceFunctionName ? ` ${script.sourceFunctionName}` : ''
  return `${cleanInvoker(script.invoker, origin)} @ ${where}${fn} ${Math.round(script.duration)}ms`
}

/** What one slow interaction reports, or null when it was not slow. */
export function slowInteractionProps(
  event: EventTiming,
  frames: readonly Frame[],
  context: { target: string; hidden: boolean; origin: string }
): SlowInteractionProps | null {
  if (event.duration < SLOW_MS) return null
  const end = event.startTime + event.duration
  const overlapping = frames.filter(
    (frame) =>
      frame.startTime < end &&
      frame.startTime + frame.duration > event.startTime
  )
  const scripts = overlapping
    .flatMap((frame) => frame.scripts ?? [])
    .sort((a, b) => b.duration - a.duration)
  const sum = (pick: (s: FrameScript) => number) =>
    Math.round(scripts.reduce((total, s) => total + pick(s), 0))
  return {
    interaction: event.name,
    duration_ms: Math.round(event.duration),
    input_delay_ms: Math.round(event.processingStart - event.startTime),
    processing_ms: Math.round(event.processingEnd - event.processingStart),
    presentation_ms: Math.round(end - event.processingEnd),
    target: context.target,
    since_load_s: Math.round(event.startTime / 100) / 10,
    hidden: context.hidden,
    frames: overlapping.length,
    script_ms: sum((s) => s.duration),
    forced_layout_ms: sum((s) => s.forcedStyleAndLayoutDuration ?? 0),
    top_scripts: scripts
      .slice(0, 3)
      .map((s) => describeScript(s, context.origin)),
  }
}

const INTERACTIVE =
  'button,a,input,select,textarea,label,summary,[role="button"],[tabindex]'

function targetOf(node: EventTarget | null): string {
  if (!(node instanceof Element)) return ''
  return describeTarget(node.closest(INTERACTIVE) ?? node)
}

/**
 * One tap is several entries (pointerdown, pointerup, click) that share a
 * frame and so a duration; the one whose handlers ran longest is the story.
 */
export function longer(a: EventTiming, b: EventTiming): boolean {
  if (a.duration !== b.duration) return a.duration > b.duration
  return (
    a.processingEnd - a.processingStart > b.processingEnd - b.processingStart
  )
}

type EventEntry = PerformanceEntry &
  EventTiming & { interactionId?: number; target?: Node | null }

/**
 * Watches every interaction; one report per slow interaction (its longest
 * event), sent a second later so the frames it caused have been observed.
 */
export function installSlowInteractionReporter(
  report: (props: SlowInteractionProps) => void
): void {
  if (typeof PerformanceObserver === 'undefined') return
  const supported = PerformanceObserver.supportedEntryTypes ?? []
  if (!supported.includes('event')) return

  const frames: Frame[] = []
  const pending = new Map<number, { entry: EventEntry; target: string }>()
  let lastTarget = ''
  let hiddenAt = -1
  let sent = 0

  const remember = (event: Event) => {
    lastTarget = targetOf(event.target)
  }
  document.addEventListener('pointerdown', remember, {
    capture: true,
    passive: true,
  })
  document.addEventListener('keydown', remember, {
    capture: true,
    passive: true,
  })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now()
  })

  if (supported.includes('long-animation-frame')) {
    new PerformanceObserver((list) => {
      frames.push(...(list.getEntries() as unknown as Frame[]))
      if (frames.length > 40) frames.splice(0, frames.length - 40)
    }).observe({ type: 'long-animation-frame', buffered: true })
  }

  const flush = (id: number) => {
    const item = pending.get(id)
    pending.delete(id)
    if (!item || sent >= MAX_REPORTS) return
    const { entry } = item
    const hidden =
      hiddenAt >= entry.startTime &&
      hiddenAt <= entry.startTime + entry.duration
    const props = slowInteractionProps(entry, frames, {
      target: item.target,
      hidden,
      origin: window.location.origin,
    })
    if (!props) return
    sent++
    report(props)
  }

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as EventEntry[]) {
      const id = entry.interactionId
      if (!id || entry.duration < SLOW_MS || sent >= MAX_REPORTS) continue
      const known = pending.get(id)
      const target =
        targetOf(entry.target ?? null) || known?.target || lastTarget
      if (!known) window.setTimeout(() => flush(id), 1000)
      if (!known || longer(entry, known.entry))
        pending.set(id, { entry, target })
    }
  }).observe({
    type: 'event',
    durationThreshold: 104,
    buffered: true,
  } as PerformanceObserverInit)
}
