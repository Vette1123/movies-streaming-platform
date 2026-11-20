import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

import { C, FONT, GRADIENT, OUT_EXPO } from '../theme'

/** Landscape or portrait, and the type scale that goes with it. */
export function useLayout() {
  const { width, height } = useVideoConfig()
  const landscape = width > height
  return {
    landscape,
    width,
    height,
    heading: landscape ? 96 : 112,
    sub: landscape ? 34 : 40,
  }
}

/** 0 → 1 over `len` frames from `from`, eased. Clamped both ends. */
export const ease = (
  frame: number,
  from: number,
  len: number,
  easing = OUT_EXPO
) =>
  interpolate(frame, [from, from + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  })

/** A critically damped spring from `from`: settles without wobbling past its mark. */
export function useSpring(from: number, stiffness = 120, damping = 18) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({
    frame: frame - from,
    fps,
    config: { stiffness, damping, mass: 1 },
  })
}

/**
 * The site's ground: navy-black, a blue, a sky and an indigo glow drifting over a faint
 * grid, then grain. The drift and the grain are not decoration: a still dark gradient
 * bands the moment H.264 quantises it.
 */
export const Backdrop: React.FC<{ glow?: number; seed?: number }> = ({
  glow = 1,
  seed = 0,
}) => {
  const frame = useCurrentFrame()
  const t = (frame + seed * 300) / 1200
  const p = (base: number, amp: number, k: number) =>
    base + Math.sin(t * Math.PI * 2 * k) * amp
  const layers = [
    'radial-gradient(80% 80% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)',
    `radial-gradient(50% 50% at ${p(18, 8, 0.6)}% ${p(22, 6, 0.4)}%, rgba(37,99,235,${0.26 * glow}) 0%, rgba(37,99,235,0) 100%)`,
    `radial-gradient(55% 55% at ${p(84, 7, 0.5)}% ${p(70, 8, 0.7)}%, rgba(129,140,248,${0.2 * glow}) 0%, rgba(129,140,248,0) 100%)`,
    `radial-gradient(45% 45% at ${p(60, 10, 0.3)}% ${p(10, 5, 0.5)}%, rgba(147,197,253,${0.12 * glow}) 0%, rgba(147,197,253,0) 100%)`,
    C.bg,
  ]
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: layers.join(', ') }} />
      <AbsoluteFill
        style={{
          opacity: 0.5,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          backgroundPosition: `0 ${(frame * 0.25) % 72}px`,
          maskImage:
            'radial-gradient(70% 60% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.08,
          mixBlendMode: 'soft-light',
          backgroundImage: `url(${staticFile('grain.png')})`,
          backgroundSize: '256px 256px',
          backgroundPosition: `${(frame * 37) % 256}px ${(frame * 53) % 256}px`,
        }}
      />
    </AbsoluteFill>
  )
}

/**
 * Words that arrive one by one: each rises, sharpens out of a blur and lands. The
 * `accent` words take the brand gradient; a lone `|` forces a line break.
 */
export const Words: React.FC<{
  text: string
  from: number
  size: number
  accent?: string[]
  stagger?: number
  weight?: number
  align?: 'left' | 'center'
  color?: string
  out?: number
}> = ({
  text,
  from,
  size,
  accent = [],
  stagger = 4,
  weight = 800,
  align = 'left',
  color = C.ink,
  out,
}) => {
  const frame = useCurrentFrame()
  const leave = out === undefined ? 0 : ease(frame, out, 14)
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.26,
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.04,
        letterSpacing: -size * 0.04,
        color,
        opacity: 1 - leave,
        transform: `translateY(${-leave * 30}px)`,
        filter: leave > 0 ? `blur(${leave * 10}px)` : undefined,
      }}
    >
      {text.split(' ').map((word, i) => {
        // A lone `|` is a line break: it owns a full row, so the next word starts a new line.
        if (word === '|')
          return <div key={i} style={{ flexBasis: '100%', height: 0 }} />
        const k = ease(frame, from + i * stagger, 22)
        const isAccent = accent.includes(word.replace(/[.,!?]/g, ''))
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: k,
              transform: `translateY(${(1 - k) * size * 0.5}px) scale(${0.94 + k * 0.06})`,
              filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined,
              ...(isAccent ? accentStyle : null),
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

const accentStyle: React.CSSProperties = {
  backgroundImage: GRADIENT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  paddingBottom: '0.08em',
}

/** The app mark: the same 512px icon the site installs with (public/android-chrome-512x512.png). */
export const Mark: React.FC<{ size: number; style?: React.CSSProperties }> = ({
  size,
  style,
}) => (
  <Img
    src={staticFile('mark.png')}
    style={{ width: size, height: size, borderRadius: size * 0.22, ...style }}
  />
)

/**
 * A desktop browser around a real capture of the live site. `scroll` is the share of the
 * capture's height scrolled past (0 = top).
 */
export const Browser: React.FC<{
  src: string
  width: number
  url: string
  scroll?: number
  /** Push into the page: scale about `origin` (percent of the capture). Children ride along. */
  zoom?: number
  origin?: [number, number]
  children?: React.ReactNode
  style?: React.CSSProperties
}> = ({
  src,
  width,
  url,
  scroll = 0,
  zoom = 1,
  origin = [50, 0],
  children,
  style,
}) => {
  const bar = width * 0.034
  const height = width * 0.625 + bar
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.012,
        overflow: 'hidden',
        background: '#0d0f14',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow:
          '0 60px 140px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.6), 0 0 120px rgba(96,165,250,0.14)',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          height: bar,
          display: 'flex',
          alignItems: 'center',
          gap: bar * 0.24,
          padding: `0 ${bar * 0.5}px`,
          background: '#14171d',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div
            key={c}
            style={{
              width: bar * 0.3,
              height: bar * 0.3,
              borderRadius: '50%',
              background: c,
            }}
          />
        ))}
        <div
          style={{
            marginLeft: bar * 0.6,
            flex: 1,
            maxWidth: width * 0.42,
            height: bar * 0.6,
            borderRadius: bar,
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: bar * 0.2,
            padding: `0 ${bar * 0.4}px`,
            fontFamily: FONT,
            fontSize: bar * 0.34,
            color: C.dim,
          }}
        >
          <svg
            width={bar * 0.3}
            height={bar * 0.3}
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.dim}
            strokeWidth="2.5"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {url}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          height: height - bar,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            transform: `translateY(${-scroll * 100}%) scale(${zoom})`,
            transformOrigin: `${origin[0]}% ${origin[1]}%`,
          }}
        >
          <Img src={src} style={{ width: '100%', display: 'block' }} />
          {children}
        </div>
      </div>
    </div>
  )
}

/** A phone around a real mobile capture. */
export const Phone: React.FC<{
  src: string
  width: number
  style?: React.CSSProperties
  children?: React.ReactNode
}> = ({ src, width, style, children }) => {
  const height = width * 2.08
  return (
    <div
      style={{
        width,
        height,
        borderRadius: width * 0.15,
        padding: width * 0.035,
        background:
          'linear-gradient(160deg, #2a2f39 0%, #0b0d11 40%, #1b1f27 100%)',
        boxShadow:
          '0 60px 140px rgba(0,0,0,0.75), inset 0 0 0 2px rgba(255,255,255,0.08), 0 0 100px rgba(129,140,248,0.2)',
        position: 'relative',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: width * 0.12,
          overflow: 'hidden',
          position: 'relative',
          background: C.bg,
        }}
      >
        <Img src={src} style={{ width: '100%', display: 'block' }} />
        {children}
        <div
          style={{
            position: 'absolute',
            top: width * 0.03,
            left: '50%',
            transform: 'translateX(-50%)',
            width: width * 0.3,
            height: width * 0.085,
            borderRadius: width,
            background: '#000',
          }}
        />
      </div>
    </div>
  )
}

/** A pointer that travels to a spot and clicks, with a ripple on the click. */
export const Cursor: React.FC<{
  path: Array<[number, number, number]>
  click: number
  size?: number
}> = ({ path, click, size = 44 }) => {
  const frame = useCurrentFrame()
  const frames = path.map((p) => p[0])
  const x = interpolate(
    frame,
    frames,
    path.map((p) => p[1]),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT_EXPO }
  )
  const y = interpolate(
    frame,
    frames,
    path.map((p) => p[2]),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: OUT_EXPO }
  )
  const press = interpolate(
    frame,
    [click - 3, click, click + 6],
    [1, 0.84, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const ripple = ease(frame, click, 26)
  const shown = ease(frame, frames[0], 8)
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: shown,
        pointerEvents: 'none',
      }}
    >
      {frame >= click && (
        <div
          style={{
            position: 'absolute',
            left: -size,
            top: -size,
            width: size * 2,
            height: size * 2,
            borderRadius: '50%',
            border: `3px solid ${C.blue}`,
            opacity: 1 - ripple,
            transform: `scale(${0.3 + ripple * 1.4})`,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          transform: `scale(${press})`,
          transformOrigin: '10% 10%',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.6))',
        }}
      >
        <path
          d="M4 2.5l15 9.2-6.6 1.5 3.7 7.1-2.9 1.5-3.7-7.2L4.6 19z"
          fill="#fff"
          stroke="#0b0d11"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/** A quiet glass pill: a dot and a few words. */
export const Pill: React.FC<{
  children: React.ReactNode
  size: number
  tone?: 'green' | 'blue'
  style?: React.CSSProperties
}> = ({ children, size, tone = 'blue', style }) => {
  const dot = tone === 'green' ? C.green : C.blue
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.5,
        padding: `${size * 0.5}px ${size * 0.95}px`,
        borderRadius: size * 2,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${tone === 'green' ? 'rgba(34,197,94,0.4)' : 'rgba(96,165,250,0.4)'}`,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: size,
        color: tone === 'green' ? '#dcfce7' : '#bfdbfe',
        ...style,
      }}
    >
      <div
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: '50%',
          background: dot,
          boxShadow: `0 0 ${size * 0.6}px ${dot}`,
        }}
      />
      {children}
    </div>
  )
}
