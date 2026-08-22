'use client'

import * as React from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'

import { resolveStreamApi } from '@/lib/api-client'
import {
  clearPosition,
  formatPlaybackTime,
  playbackKey,
  readPosition,
  resumableSeconds,
  writePosition,
} from '@/lib/playback-positions'
import { type SelfHostTarget } from '@/lib/stream-resolver'
import { cn } from '@/lib/utils'

/**
 * The self-hosted player: OUR video element, OUR controls, zero ads.
 *
 * Replaces the third-party embed entirely. Instead of pointing an iframe at a
 * page we do not control, this asks our Worker for one master HLS manifest
 * (`resolveStreamApi`) and plays it with hls.js inside ArtPlayer. Every pixel
 * of chrome is drawn by us, so there is no ad slot, no popup, no sandbox arms
 * race — lib/embed-policy.ts documents what fighting the iframe cost.
 *
 * What it does:
 *   - English voice whenever the stream offers it (audioPreference), with an
 *     Audio selector for everything else the manifest carries.
 *   - Subtitles from two sources behind ONE dedicated CC button on the
 *     control bar (not buried in settings): the stream's embedded renditions
 *     (hls.js renders those natively) and external languages served by our
 *     Worker (/api/stream/subtitles.vtt, backed by SubDL) because no title's
 *     embedded set ever carries Arabic. Off is the default, like every
 *     mainstream player.
 *   - Resume: positions land in lib/playback-positions.ts every ~5s and on
 *     pause/leave; the next boot seeks straight back and says so. Finishing
 *     (>=95%) clears the position instead of pinning the credits.
 *   - Quality (Auto + levels), speed, PiP, both fullscreens, ±10s buttons,
 *     keyboard hotkeys, drag-scrubbing, mini progress bar, mobile gestures.
 *
 * Media bytes never touch our Worker: the manifest, segments and AES key are
 * CORS-open on the provider CDN (measured, see lib/stream-resolver.ts), so
 * after the ~3-request resolve the browser streams straight from them.
 *
 * POC gate: rendered only while the URL carries `?player=self`; the iframe
 * path stays exactly as shipped otherwise. See components/details-hero.tsx.
 */

type Phase = 'resolving' | 'connecting' | 'playing' | 'error'

/** Lucide RotateCcw/RotateCw geometry, as HTML strings for ArtPlayer controls. */
const REWIND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'
const FORWARD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>'
/** Lucide "captions": the CC button every mainstream player trains users on. */
const CC_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="14" x="3" y="5" rx="2" ry="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/></svg>'
/**
 * Baseline look for OUR external-subtitle overlay. Not ArtPlayer's layer:
 * measured 2026-08-22, its `.art-subtitle` node stayed empty (`kids: 0`)
 * even with a valid URL loaded and show=true — so we fetch, parse and paint
 * cues ourselves and fully control placement (above the control bar).
 */
const SUB_LAYER_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '0',
  right: '0',
  bottom: '84px',
  display: 'flex',
  justifyContent: 'center',
  zIndex: '55',
  pointerEvents: 'none',
  padding: '0 24px',
}

const SUB_TEXT_STYLE: Partial<CSSStyleDeclaration> = {
  background: 'rgba(0, 0, 0, 0.72)',
  color: '#fff',
  padding: '6px 14px',
  borderRadius: '8px',
  fontSize: 'clamp(15px, 2.4vw, 22px)',
  fontWeight: '500',
  lineHeight: '1.4',
  textAlign: 'center',
  whiteSpace: 'pre-line',
  maxWidth: '100%',
}

interface SubCue {
  start: number
  end: number
  text: string
}

const cueSeconds = (h: string, m: string, s: string, ms: string): number =>
  Number(h) * 3600 +
  Number(m) * 60 +
  Number(s) +
  Number(ms.padEnd(3, '0')) / 1000

/** Minimal but strict WEBVTT cue reader for what srtToVtt emits. */
const parseVttCues = (raw: string): SubCue[] => {
  const stamps =
    /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/
  const cues: SubCue[] = []
  for (const block of raw.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n')
    const index = lines.findIndex((line) => stamps.test(line))
    if (index < 0) continue
    const match = lines[index].match(stamps)!
    const start = cueSeconds(match[1], match[2], match[3], match[4])
    const end = cueSeconds(match[5], match[6], match[7], match[8])
    const text = lines
      .slice(index + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (text) cues.push({ start, end, text })
  }
  return cues.sort((a, b) => a.start - b.start)
}

/** The player chrome follows whichever accent theme is active, not a literal. */
const readAccentColor = (): string => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim()
  return raw ? `hsl(${raw})` : '#3b82f6'
}

/** Same-origin VTT endpoint for externally-sourced subtitles. */
const externalSubtitleUrl = (target: SelfHostTarget, lang: string): string => {
  const params = new URLSearchParams({
    type: target.type,
    id: String(target.id),
    lang,
  })
  if (target.title) params.set('title', target.title)
  if (target.year) params.set('year', String(target.year))
  if (target.type === 'tv') {
    params.set('season', String(target.season ?? 1))
    params.set('episode', String(target.episode ?? 1))
  }
  return `/api/stream/subtitles.vtt?${params.toString()}`
}

const targetKey = (target: SelfHostTarget): string =>
  `${target.type}:${target.id}:${target.season ?? ''}:${target.episode ?? ''}`

/**
 * Inline styles for the runtime-built subtitle popover. Not Tailwind: these
 * classes are created after hydration, and inline styles cannot be purged.
 */
const PICKER_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  right: '12px',
  bottom: '64px',
  zIndex: '60',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: '180px',
  maxHeight: '55%',
  overflowY: 'auto',
  padding: '6px',
  background: 'rgba(20, 20, 24, 0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  backdropFilter: 'blur(8px)',
}

const PICKER_ROW_STYLE: Partial<CSSStyleDeclaration> = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  width: '100%',
  padding: '7px 10px',
  border: 'none',
  borderRadius: '6px',
  background: 'transparent',
  color: '#fff',
  fontSize: '13px',
  lineHeight: '1.3',
  cursor: 'pointer',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

/**
 * Selector labels for the external languages, mirrored from
 * lib/stream/subdl.ts. Duplicated as literals on purpose: that module pulls
 * fflate into the bundle, and the player must not pay for a zip reader it
 * never uses.
 */
const EXTERNAL_LABELS: Record<string, string> = {
  ar: 'العربية · Arabic',
  en: 'English',
  fr: 'Français · French',
  de: 'Deutsch · German',
  es: 'Español · Spanish',
  tr: 'Türkçe · Turkish',
  pt: 'Português · Portuguese',
  ru: 'Русский · Russian',
  it: 'Italiano · Italian',
  id: 'Indonesia · Indonesian',
  fa: 'فارسی · Persian',
}

export function SelfHostedPlayer({ target }: { target: SelfHostTarget }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  // Which target+attempt the mounted player belongs to, so a stale async boot
  // can never wire a dead instance into the live DOM.
  const [phase, setPhase] = React.useState<Phase>('resolving')
  const [attempt, setAttempt] = React.useState(0)
  // Set when a saved position was actually applied; drives the resume pill.
  const [resumedFrom, setResumedFrom] = React.useState<number | null>(null)
  const key = `${targetKey(target)}#${attempt}`

  React.useEffect(() => {
    let cancelled = false
    let teardown = () => {}
    let noteTimer: ReturnType<typeof setTimeout> | undefined

    const boot = async () => {
      try {
        // Dynamic imports: both libraries assume a browser at module scope,
        // and neither should be in the main bundle for the 99% of views where
        // nothing plays.
        const [result, { default: Artplayer }, { default: Hls }] =
          await Promise.all([
            resolveStreamApi(target),
            import('artplayer'),
            import('hls.js'),
          ])
        const source = result.sources[0]
        if (!source) throw new Error('resolver returned no source')
        if (cancelled || !containerRef.current) return

        setPhase('connecting')
        const accent = readAccentColor()
        const pKey = playbackKey(
          target.type,
          target.id,
          target.season,
          target.episode
        )
        const resumeAt = resumableSeconds(readPosition(pKey))
        // Set once the CC button exists; teardown removes its document-level
        // listeners with it.
        let pickerCleanup: (() => void) | null = null

        const art = new Artplayer({
          container: containerRef.current,
          url: source.url,
          type: 'm3u8',
          customType: {
            m3u8(video: HTMLVideoElement, url: string) {
              if (Hls.isSupported()) {
                const hls = new Hls({
                  backBufferLength: 90,
                  // English voice without a click: hls.js applies this while
                  // selecting the audio rendition, before the first sample.
                  // A stream with no English track falls back to its default.
                  audioPreference: { lang: 'eng' },
                  ...(resumeAt ? { startPosition: resumeAt } : {}),
                })
                hls.loadSource(url)
                hls.attachMedia(video)

                hls.on(Hls.Events.ERROR, (_event, data) => {
                  if (!data.fatal) return
                  // The two recoverable fatals first — a blip must not become
                  // an error screen. Everything else is final here.
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad()
                    return
                  }
                  if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError()
                    return
                  }
                  setPhase('error')
                })

                let selectorsBuilt = false
                const buildSelectors = () => {
                  if (selectorsBuilt || !art.setting) return
                  selectorsBuilt = true

                  // --- Quality ------------------------------------------------
                  const levels = hls.levels ?? []
                  if (levels.length > 1) {
                    art.setting.add({
                      name: 'Quality',
                      html: 'Quality',
                      icon: '',
                      tooltip: 'Auto',
                      width: 180,
                      selector: [
                        { html: 'Auto', default: true, level: -1, height: 0 },
                        ...levels
                          .map((level, index) => ({
                            html: level.height
                              ? `${level.height}p`
                              : `${Math.round(level.bitrate / 1000)}k`,
                            default: false,
                            level: index,
                            height: level.height ?? 0,
                          }))
                          .sort((a, b) => b.height - a.height),
                      ],
                      onSelect(item) {
                        const choice = item as typeof item & { level: number }
                        hls.currentLevel = choice.level
                        return item.html
                      },
                    })
                  }

                  // --- Audio --------------------------------------------------
                  // Defaults reflect what hls.js ACTUALLY picked after the
                  // English preference above was applied — never a guess.
                  const audioTracks = hls.audioTracks ?? []
                  if (audioTracks.length > 1) {
                    art.setting.add({
                      name: 'Audio',
                      html: 'Audio',
                      icon: '',
                      tooltip:
                        audioTracks[hls.audioTrack]?.name ??
                        audioTracks[hls.audioTrack]?.lang ??
                        'Default',
                      width: 180,
                      selector: audioTracks.map((track) => ({
                        html:
                          track.name || track.lang || `Audio ${track.id + 1}`,
                        default: track.id === hls.audioTrack,
                        id: track.id,
                      })),
                      onSelect(item) {
                        const choice = item as typeof item & { id: number }
                        hls.audioTrack = choice.id
                        return item.html
                      },
                    })
                  }

                  // --- Subtitles: dedicated CC button -------------------------
                  // Out of the settings menu entirely — a CC button on the
                  // control bar opens our own popover listing Off, the
                  // manifest's embedded renditions, and every external
                  // language. Selecting anything first turns ALL channels off,
                  // so they can never stack.
                  //
                  // External languages render through OUR overlay (fetch ->
                  // parseVttCues -> paint on timeupdate), not ArtPlayer's
                  // subtitle plugin — measured 2026-08-22, that plugin's
                  // `.art-subtitle` node stayed empty even with a valid URL
                  // loaded and show=true.
                  const external = result.externalSubtitleLangs ?? []

                  const subLayer = document.createElement('div')
                  Object.assign(subLayer.style, SUB_LAYER_STYLE)
                  const subText = document.createElement('span')
                  Object.assign(subText.style, SUB_TEXT_STYLE)
                  subLayer.appendChild(subText)

                  let activeExternal: string | null = null
                  let picker: HTMLDivElement | null = null
                  const subCues: SubCue[] = []

                  // Embedded rows whose label collides with an external one
                  // are dropped — the same language must never appear twice
                  // in the list; ours is the reliable copy.
                  const externalLabels = new Set(
                    external.map((code) =>
                      (
                        EXTERNAL_LABELS[code] ?? code.toUpperCase()
                      ).toLowerCase()
                    )
                  )
                  const embeddedRows = (hls.subtitleTracks ?? [])
                    .map((track, id) => ({
                      id,
                      label:
                        track.name ||
                        track.lang?.toUpperCase() ||
                        `Subtitle ${id + 1}`,
                    }))
                    .filter(
                      (row) => !externalLabels.has(row.label.toLowerCase())
                    )

                  const closePicker = () => {
                    if (!picker) return
                    picker.remove()
                    picker = null
                    document.removeEventListener('click', onDocClick)
                  }
                  const onDocClick = (event: MouseEvent) => {
                    // Clicks anywhere outside an open popover dismiss it;
                    // clicks on the rows themselves land inside `picker`.
                    if (picker && event.target instanceof Node) {
                      const host = picker.parentElement
                      if (!host?.contains(event.target)) closePicker()
                    }
                  }

                  const clearExternalLayer = () => {
                    subCues.length = 0
                    subText.textContent = ''
                    subLayer.remove()
                  }

                  const updateSubLayer = () => {
                    if (!subCues.length) return
                    const t = art.currentTime
                    const cue = subCues.find((c) => c.start <= t && c.end >= t)
                    const next = cue ? cue.text : ''
                    if (next !== subText.textContent) {
                      subText.textContent = next
                    }
                  }
                  art.on('video:timeupdate', updateSubLayer)

                  const activeKey = (): string => {
                    if (activeExternal) return `ext:${activeExternal}`
                    if (
                      hls.subtitleDisplay &&
                      hls.subtitleTrack >= 0 &&
                      typeof hls.subtitleTrack === 'number'
                    ) {
                      return `track:${hls.subtitleTrack}`
                    }
                    return ''
                  }

                  const applyChoice = (choice: {
                    key?: string
                    trackId?: number
                    external?: string
                  }) => {
                    hls.subtitleDisplay = false
                    hls.subtitleTrack = -1
                    clearExternalLayer()
                    activeExternal = null

                    if (choice.external) {
                      activeExternal = choice.external
                      const url = externalSubtitleUrl(target, choice.external)
                      void fetch(url)
                        .then((res) => {
                          if (!res.ok) throw new Error(`vtt ${res.status}`)
                          return res.text()
                        })
                        .then((vtt) => {
                          const cues = parseVttCues(vtt)
                          // Stale guard: a slower earlier fetch must never
                          // paint over a later choice.
                          if (activeExternal !== choice.external) return
                          subCues.push(...cues)
                          containerRef.current?.appendChild(subLayer)
                        })
                        .catch(() => {
                          // Selection stays marked — the check reflects the
                          // user's choice, not the network's mood. A failed
                          // load simply shows no text.
                        })
                    } else if (
                      typeof choice.trackId === 'number' &&
                      choice.trackId >= 0
                    ) {
                      hls.subtitleTrack = choice.trackId
                      hls.subtitleDisplay = true
                    }

                    // Instant feedback rule: selecting ALWAYS closes the
                    // popover. Tint the CC icon via a live DOM lookup —
                    // controls.add()'s return value is unreliable across
                    // ArtPlayer versions, and a throw here used to skip the
                    // close below, leaving stale marks on screen.
                    const ccEl =
                      containerRef.current?.querySelector<HTMLElement>(
                        '.art-control-cc-picker'
                      )
                    if (ccEl) {
                      ccEl.style.color = activeKey() ? accent : ''
                    }
                    closePicker()
                  }

                  const openPicker = () => {
                    closePicker()
                    picker = document.createElement('div')
                    Object.assign(picker.style, PICKER_STYLE)

                    const rows: {
                      key: string
                      label: string
                      choice: Record<string, unknown>
                    }[] = [
                      { key: '', label: 'Off', choice: {} },
                      ...embeddedRows.map((row) => ({
                        key: `track:${row.id}`,
                        label: row.label,
                        choice: { trackId: row.id },
                      })),
                      ...external.map((code) => ({
                        key: `ext:${code}`,
                        label:
                          EXTERNAL_LABELS[code] ??
                          `${code.toUpperCase()} (external)`,
                        choice: { external: code },
                      })),
                    ]

                    for (const row of rows) {
                      const el = document.createElement('button')
                      el.type = 'button'
                      Object.assign(el.style, PICKER_ROW_STYLE)
                      el.dataset.key = row.key
                      if (row.key === activeKey()) {
                        // Unmistakable selected state: tinted row, bold label,
                        // accent check — survives every rebuild.
                        el.style.background = 'rgba(255,255,255,0.16)'
                        el.style.fontWeight = '600'
                        el.innerHTML = `<span>${row.label}</span><span style="color:${accent};font-weight:700">✓</span>`
                      } else {
                        el.textContent = row.label
                      }
                      el.addEventListener('click', (event) => {
                        event.stopPropagation()
                        applyChoice(row.choice)
                      })
                      picker.appendChild(el)
                    }

                    containerRef.current?.appendChild(picker)
                    document.addEventListener('click', onDocClick)
                  }

                  art.controls.add({
                    name: 'cc-picker',
                    position: 'right',
                    index: 9,
                    tooltip: 'Subtitles',
                    html: CC_ICON,
                    click() {
                      if (picker) closePicker()
                      else openPicker()
                    },
                  })

                  const teardownSubtitles = () => {
                    closePicker()
                    art.off('video:timeupdate', updateSubLayer)
                    subLayer.remove()
                  }
                  pickerCleanup = teardownSubtitles
                }

                hls.on(Hls.Events.MANIFEST_PARSED, buildSelectors)
                // Subtitle renditions can arrive a beat after the manifest;
                // building twice would duplicate entries, hence the guard.
                hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, buildSelectors)
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari plays HLS natively — fewer toys, but it plays.
                if (resumeAt) {
                  video.addEventListener(
                    'loadedmetadata',
                    () => {
                      video.currentTime = resumeAt
                    },
                    { once: true }
                  )
                }
                video.src = url
              } else {
                setPhase('error')
              }
            },
          },
          autoplay: true,
          setting: true,
          playbackRate: true,
          aspectRatio: true,
          flip: true,
          fullscreen: true,
          fullscreenWeb: true,
          pip: true,
          miniProgressBar: true,
          // Mobile niceties that cost nothing elsewhere: rotate-to-fullscreen
          // by video shape, long-press for 2x, gesture lock in fullscreen.
          autoOrientation: true,
          fastForward: true,
          lock: true,
          hotkey: true,
          mutex: true,
          theme: accent,
          lang: 'en',
          moreVideoAttr: {
            playsInline: true,
          },
        })

        if (cancelled) {
          art.destroy(false)
          return
        }

        // Browser-verification handle. `?player=self` IS the test surface, so
        // driving scripts may reach the internals instead of trusting pixels.
        const win = window as unknown as Record<string, unknown>
        win.__selfHostPlayer = { art }

        // Visible proof for the thing the iframe could never promise: named
        // skip buttons beside the native ones, on OUR chrome.
        art.controls.add({
          name: 'rewind-10',
          position: 'left',
          index: 1,
          tooltip: '-10s',
          html: REWIND_ICON,
          click() {
            art.currentTime = Math.max(0, art.currentTime - 10)
          },
        })
        art.controls.add({
          name: 'forward-10',
          position: 'left',
          index: 2,
          tooltip: '+10s',
          html: FORWARD_ICON,
          click() {
            art.currentTime = Math.min(
              art.duration || Infinity,
              art.currentTime + 10
            )
          },
        })

        // --- Position tracking ---------------------------------------------
        //
        // Write at most every ~5s during playback, immediately on pause and
        // teardown; clear once the credits roll so "resume" never means
        // "resume into the end card". All writes go through one function so
        // the finished-vs-in-progress rule exists exactly once.
        let lastSavedAt = 0
        const persist = (force = false) => {
          const now = Date.now()
          if (!force && now - lastSavedAt < 5000) return
          const current = art.currentTime
          const total = art.duration
          if (!Number.isFinite(current)) return
          if (current < 5) return
          lastSavedAt = now
          if (Number.isFinite(total) && total > 0 && current >= total * 0.95) {
            clearPosition(pKey)
            return
          }
          writePosition(
            pKey,
            current,
            Number.isFinite(total) ? total : undefined
          )
        }

        art.on('video:timeupdate', () => persist())
        art.on('video:pause', () => persist(true))
        art.on('video:ended', () => clearPosition(pKey))

        if (resumeAt) {
          setResumedFrom(resumeAt)
          noteTimer = setTimeout(() => setResumedFrom(null), 8000)
        }

        const onPlaying = () => setPhase('playing')
        // Autoplay can be refused after the await ate the user gesture; the
        // player then sits paused behind its own play button, which is a fine
        // state — but our spinner must not cover it.
        const onPause = () => setPhase('playing')
        art.on('video:playing', onPlaying)
        art.on('video:pause', onPause)

        teardown = () => {
          if (noteTimer) clearTimeout(noteTimer)
          persist(true)
          pickerCleanup?.()
          const hls = (art as unknown as { hls?: { destroy(): void } })
            .hls as unknown as { destroy(): void } | undefined
          hls?.destroy()
          delete win.__selfHostPlayer
          art.destroy(false)
        }
      } catch (error) {
        console.error('self-hosted playback failed', error)
        if (!cancelled) setPhase('error')
      }
    }

    void boot()
    return () => {
      cancelled = true
      teardown()
    }
    // `key` folds in the retry attempt; target identity is value-based.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const startOver = () => {
    setResumedFrom(null)
    const video = containerRef.current?.querySelector('video')
    if (video && Number.isFinite(video.duration)) video.currentTime = 0
  }

  return (
    <div className="relative size-full overflow-hidden rounded-md bg-black">
      <div ref={containerRef} className="size-full" />
      {resumedFrom !== null && phase === 'playing' && (
        // Above the control bar (bottom ~64px), left edge, out of the scrubber's
        // way. Auto-fades; "Start over" is the only action worth offering.
        <div className="absolute bottom-20 left-4 z-20 flex items-center gap-2 rounded-full bg-black/70 py-1.5 pr-1.5 pl-3 text-xs text-white backdrop-blur-sm">
          <RotateCcw className="size-3.5 shrink-0 opacity-70" />
          <span className="whitespace-nowrap">
            Resumed from {formatPlaybackTime(resumedFrom)}
          </span>
          <button
            type="button"
            onClick={startOver}
            className="rounded-full bg-white/15 px-2 py-0.5 font-medium transition-colors hover:bg-white/25"
          >
            Start over
          </button>
        </div>
      )}
      {phase !== 'playing' && (
        <div
          aria-live="polite"
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity',
            phase === 'error' && 'bg-black/95'
          )}
        >
          {phase === 'error' ? (
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <AlertTriangle className="size-8 text-amber-300" />
              <p className="text-sm font-medium text-white">
                No direct stream for this title right now.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Reset before the attempt bump so the retry boots from
                    // the spinner, and the effect itself stays setState-free.
                    setPhase('resolving')
                    setAttempt((value) => value + 1)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-white/90"
                >
                  Try again
                </button>
                {/* Escape hatch back to the iframe path: dropping the param
                    re-renders the exact page every other visitor sees. */}
                <button
                  type="button"
                  onClick={() =>
                    window.location.assign(window.location.pathname)
                  }
                  className="rounded-full border border-white/20 px-3 py-1.5 font-medium text-white/80 transition-colors hover:bg-white/10"
                >
                  Use default server
                </button>
              </div>
            </div>
          ) : (
            <Loader2 className="size-12 animate-spin text-white/80" />
          )}
        </div>
      )}
    </div>
  )
}
