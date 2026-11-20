import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'

import {
  Backdrop,
  Browser,
  Cursor,
  ease,
  Mark,
  Phone,
  Pill,
  useLayout,
  useSpring,
  Words,
} from './components/kit'
import { C, FONT, GRADIENT, IN_OUT, OUT_EXPO } from './theme'

const SITE = 'reely.space'
const shot = (name: string) => staticFile(`shots/${name}.png`)

/** Deterministic 0..1 per index, so the wall looks random and renders the same every time. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Drawn poster art, as on the share card: gradients, never real artwork. */
const POSTER_ART = [
  'linear-gradient(160deg, #f59e0b 0%, #b45309 45%, #1c0a02 100%)',
  'linear-gradient(160deg, #a78bfa 0%, #4c1d95 50%, #0b0420 100%)',
  'linear-gradient(165deg, #60a5fa 0%, #1e3a8a 50%, #050a1f 100%)',
  'linear-gradient(160deg, #f472b6 0%, #831843 50%, #13020a 100%)',
  'linear-gradient(160deg, #34d399 0%, #065f46 50%, #021410 100%)',
  'linear-gradient(160deg, #f87171 0%, #7f1d1d 50%, #140303 100%)',
]

const Poster: React.FC<{
  i: number
  w: number
  style?: React.CSSProperties
  children?: React.ReactNode
}> = ({ i, w, style, children }) => (
  <div
    style={{
      width: w,
      height: w * 1.5,
      borderRadius: w * 0.06,
      background: POSTER_ART[i % POSTER_ART.length],
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      flexShrink: 0,
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(55% 35% at ${30 + hash(i) * 40}% ${25 + hash(i + 4) * 25}%, rgba(255,255,255,0.28), transparent 70%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: w * 0.1,
        right: w * 0.1,
        bottom: w * 0.2,
        height: w * 0.07,
        borderRadius: w,
        background: 'rgba(255,255,255,0.85)',
        width: w * (0.45 + hash(i + 2) * 0.35),
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: w * 0.1,
        bottom: w * 0.11,
        height: w * 0.045,
        borderRadius: w,
        background: 'rgba(255,255,255,0.45)',
        width: w * (0.3 + hash(i + 6) * 0.25),
      }}
    />
    {children}
  </div>
)

const pad = (n: number) => String(n).padStart(2, '0')

/** Beats 0-6. A wall of posters that never ends, and a clock that keeps running. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, width } = useLayout()
  const w = landscape ? 210 : 240
  const speed = interpolate(frame, [0, 170], [2.5, 16], {
    extrapolateRight: 'clamp',
    easing: IN_OUT,
  })
  const travel = frame * speed
  const cols = landscape ? 9 : 6
  // Forty-seven minutes of browsing, spent in under three seconds.
  const seconds = Math.floor(
    interpolate(frame, [20, 160], [12 * 60, 47 * 60 + 12], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: IN_OUT,
    })
  )
  const timer = ease(frame, 96, 16)
  const black = interpolate(frame, [168, 173], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const textW = width - (landscape ? 400 : 180)
  return (
    <AbsoluteFill>
      <Backdrop glow={0.6} />
      <AbsoluteFill
        style={{
          perspective: 1800,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: w * 0.14,
            transform: `rotateX(28deg) rotateZ(10deg) scale(${landscape ? 1.2 : 1.45})`,
            opacity: 0.55,
          }}
        >
          {Array.from({ length: cols }, (_, c) => {
            const dir = c % 2 === 0 ? 1 : -1
            const span = w * 1.64
            const offset =
              ((travel * (0.8 + hash(c) * 0.4) + c * 140) % span) * dir
            return (
              <div
                key={c}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: w * 0.14,
                  transform: `translateY(${offset - span * 3}px)`,
                }}
              >
                {Array.from({ length: 7 }, (_, r) => (
                  <Poster key={r} i={c * 7 + r} w={w} />
                ))}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(60% 55% at 50% 50%, rgba(2,5,20,0.9) 0%, rgba(2,5,20,0.55) 60%, rgba(2,5,20,0.2) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ position: 'absolute', width: textW }}>
          <Words
            text="Friday night. | Forty minutes of scrolling."
            from={6}
            size={heading}
            align="center"
            accent={['Forty', 'minutes']}
            out={82}
          />
        </div>
        <div style={{ position: 'absolute', width: textW }}>
          <Words
            text="Still nothing to watch."
            from={90}
            size={heading * 1.1}
            align="center"
            stagger={4}
          />
          <div
            style={{
              marginTop: heading * 0.5,
              display: 'flex',
              justifyContent: 'center',
              opacity: timer,
              transform: `translateY(${(1 - timer) * 30}px)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 30px',
                borderRadius: 22,
                background: 'rgba(15,23,42,0.75)',
                border: '1px solid rgba(248,250,252,0.16)',
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: landscape ? 32 : 38,
                color: C.dim,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke={C.gold}
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <circle cx="12" cy="13" r="8.5" />
                <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
              </svg>
              {`${Math.floor(seconds / 60)}:${pad(seconds % 60)} spent browsing`}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
    </AbsoluteFill>
  )
}

/** Beat 6, the drop: the mark lands out of a flash, the promise under it. */
export const Drop: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading } = useLayout()
  const land = useSpring(0, 140, 16)
  const flash = interpolate(frame, [0, 2, 18], [0, 0.85, 0], {
    extrapolateRight: 'clamp',
  })
  const markSize = landscape ? 200 : 250
  const ring = (at: number) => ease(frame, at, 40, OUT_EXPO)
  return (
    <AbsoluteFill>
      <Backdrop glow={1.5} seed={1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 1800,
            height: 1800,
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(96,165,250,0.11) 12deg, transparent 24deg, transparent 60deg, rgba(129,140,248,0.11) 72deg, transparent 84deg, transparent 120deg, rgba(147,197,253,0.1) 132deg, transparent 144deg, transparent 180deg, rgba(96,165,250,0.11) 192deg, transparent 204deg, transparent 240deg, rgba(129,140,248,0.11) 252deg, transparent 264deg, transparent 300deg, rgba(147,197,253,0.1) 312deg, transparent 324deg)',
            transform: `rotate(${frame * 0.25}deg) scale(${0.6 + land * 0.4})`,
            maskImage:
              'radial-gradient(closest-side, black 0%, transparent 100%)',
            opacity: land,
          }}
        />
        {[0, 7].map((at) => (
          <div
            key={at}
            style={{
              position: 'absolute',
              width: markSize,
              height: markSize,
              borderRadius: markSize * 0.22,
              border: `${4 - ring(at) * 3}px solid rgba(147,197,253,${0.7 * (1 - ring(at))})`,
              transform: `translateY(${landscape ? -150 : -250}px) scale(${1 + ring(at) * 5})`,
            }}
          />
        ))}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `translateY(${landscape ? -10 : -40}px)`,
          }}
        >
          <Mark
            size={markSize}
            style={{
              transform: `scale(${2.4 - land * 1.4})`,
              filter: `blur(${(1 - Math.min(1, land)) * 20}px) drop-shadow(0 30px 80px rgba(96,165,250,0.5))`,
            }}
          />
          <div style={{ height: landscape ? 46 : 64 }} />
          <Words
            text="Reely"
            from={14}
            size={landscape ? 52 : 60}
            weight={700}
            color={C.dim}
            align="center"
          />
          <div style={{ height: landscape ? 22 : 34 }} />
          <div
            style={{
              display: 'flex',
              flexDirection: landscape ? 'row' : 'column',
              alignItems: 'center',
              columnGap: heading * 0.3,
            }}
          >
            <Words
              text="Find what to watch."
              from={24}
              size={heading * 1.05}
              align="center"
            />
            <Words
              text="Then keep track."
              from={36}
              size={heading * 1.05}
              align="center"
              accent={['keep', 'track']}
            />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 42%, #ffffff 0%, rgba(191,219,254,0.6) 30%, transparent 70%)',
          opacity: flash,
        }}
      />
    </AbsoluteFill>
  )
}

/** Where the browser sits in the middle scenes: the same window, so the cuts read as one shot. */
function useStage() {
  const { landscape } = useLayout()
  return landscape
    ? {
        width: 1080,
        left: 760,
        top: 175,
        captionLeft: 130,
        captionTop: 330,
        captionWidth: 610,
      }
    : {
        width: 980,
        left: 50,
        top: 820,
        captionLeft: 90,
        captionTop: 250,
        captionWidth: 900,
      }
}

const Caption: React.FC<{
  title: string
  sub: string
  accent: string[]
  from?: number
}> = ({ title, sub, accent, from = 8 }) => {
  const { heading, sub: subSize } = useLayout()
  const s = useStage()
  return (
    <div
      style={{
        position: 'absolute',
        left: s.captionLeft,
        top: s.captionTop,
        width: s.captionWidth,
      }}
    >
      <Words text={title} from={from} size={heading} accent={accent} />
      <div style={{ height: subSize * 0.8 }} />
      <Words
        text={sub}
        from={from + 14}
        size={subSize}
        weight={500}
        color={C.dim}
        stagger={2}
      />
    </div>
  )
}

/** A glass chip that pops in on its beat. */
const Chip: React.FC<{
  at: number
  x: number
  y: number
  children: React.ReactNode
  size?: number
}> = ({ at, x, y, children, size = 30 }) => {
  const k = useSpring(at, 160, 14)
  const frame = useCurrentFrame()
  const bob = Math.sin((frame + at * 3) / 30) * 6
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        opacity: Math.min(1, k * 1.5),
        transform: `translateY(${(1 - k) * 40}px) scale(${0.85 + k * 0.15})`,
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.45,
        padding: `${size * 0.5}px ${size * 0.85}px`,
        borderRadius: size * 0.75,
        background: 'rgba(15,23,42,0.86)',
        border: '1px solid rgba(147,197,253,0.3)',
        boxShadow:
          '0 24px 60px rgba(0,0,0,0.55), 0 0 40px rgba(96,165,250,0.18)',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        color: C.ink,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

const Dot: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 14,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 ${size}px ${color}`,
    }}
  />
)

/** Beats 10-18. The home page, then down into its rails. */
export const Discover: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape } = useLayout()
  const s = useStage()
  const enter = useSpring(0, 90, 20)
  const scroll = interpolate(frame, [96, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: IN_OUT,
  })
  const h = s.width * 0.625
  const chips: Array<[number, string, string]> = [
    [60, 'Trending this week', C.blue],
    [90, 'Pick by mood', C.indigo],
    [120, 'Match Night', C.gold],
    [150, 'Deep filters', C.sky],
  ]
  const chipPos = (i: number): [number, number] =>
    landscape
      ? [s.left + 10 + (i % 2) * 660, s.top + 60 + i * 150]
      : [60 + (i % 2) * 470, s.top - 150 + Math.floor(i / 2) * 760 + 60]
  return (
    <AbsoluteFill>
      <Backdrop seed={2} />
      <Caption
        title="Find what to watch."
        sub="Trending rails, moods and deep filters."
        accent={['watch']}
      />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            transform: `translateX(${(1 - enter) * 500}px) rotateY(${landscape ? -16 + enter * 6 : 0}deg) rotateX(${6 - enter * 2}deg) scale(${0.9 + enter * 0.1})`,
            transformOrigin: 'left center',
            opacity: Math.min(1, enter * 1.4),
          }}
        >
          <Browser
            src={shot('home-desktop')}
            width={s.width}
            url={SITE}
            scroll={scroll}
          >
            {/* The second capture without its own nav bar (the top 7%), so the scroll reads as one page. */}
            <div
              style={{
                position: 'absolute',
                top: h,
                left: 0,
                width: '100%',
                height: h * 0.93,
                overflow: 'hidden',
              }}
            >
              <Img
                src={shot('rails-desktop')}
                style={{
                  width: '100%',
                  display: 'block',
                  marginTop: -h * 0.07,
                }}
              />
            </div>
          </Browser>
        </div>
        {chips.map(([at, label, color], i) => {
          const [x, y] = chipPos(i)
          return (
            <Chip key={label} at={at} x={x} y={y} size={landscape ? 30 : 34}>
              <Dot color={color} />
              {label}
            </Chip>
          )
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const RATINGS: Array<{ source: string; value: string; color: string }> = [
  { source: 'TMDB', value: '8.5', color: '#01b4e4' },
  { source: 'IMDb', value: '8.7', color: '#f5c518' },
  { source: 'Rotten Tomatoes', value: '73%', color: '#fa320a' },
  { source: 'Metacritic', value: '74', color: '#66cc33' },
]

/** Beats 18-26. A real title page: every rating, then onto the watchlist. */
export const Detail: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape } = useLayout()
  const s = useStage()
  const h = s.width * 0.625
  const push = interpolate(frame, [10, 90], [1, 1.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: IN_OUT,
  })
  // The Save button on the capture (bookmark, after Watch Now and Trailer).
  const save: [number, number] = [s.width * 0.313, h * 0.868]
  const click = 168
  const glow = interpolate(frame, [click, click + 4, click + 40], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const toast = useSpring(click + 6, 140, 16)
  const ratingPos = (i: number): [number, number] =>
    landscape
      ? [s.left + s.width - 120 + (i % 2) * -40, s.top + 40 + i * 118]
      : [90 + (i % 2) * 470, s.top + 700 + Math.floor(i / 2) * 120]
  return (
    <AbsoluteFill>
      <Backdrop seed={3} />
      <Caption
        title="Every rating, one page."
        sub="TMDB, IMDb, Rotten Tomatoes and Metacritic."
        accent={['rating']}
      />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            transform: `rotateY(${landscape ? -10 : 0}deg) rotateX(4deg)`,
            transformOrigin: 'left center',
          }}
        >
          <Browser
            src={shot('movie-desktop')}
            width={s.width}
            url={`${SITE}/movies/157336`}
            zoom={push}
            origin={[0, 80]}
          >
            <div
              style={{
                position: 'absolute',
                left: save[0] - 26,
                top: save[1] - 26,
                width: 52,
                height: 52,
                borderRadius: '50%',
                boxShadow: `0 0 ${50 * glow}px rgba(96,165,250,${glow}), inset 0 0 0 ${3 * glow}px rgba(255,255,255,${glow * 0.85})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `scale(${1 / push})`,
                transformOrigin: `${save[0]}px ${save[1]}px`,
              }}
            >
              <Cursor
                size={46}
                click={click}
                path={[
                  [110, save[0] + 300, save[1] - 160],
                  [158, save[0] + 4, save[1] + 2],
                ]}
              />
            </div>
          </Browser>
        </div>
        {RATINGS.map((r, i) => {
          const [x, y] = ratingPos(i)
          return (
            <Chip
              key={r.source}
              at={36 + i * 15}
              x={landscape ? x - 200 : x}
              y={y}
              size={landscape ? 28 : 32}
            >
              <Dot color={r.color} />
              <span style={{ color: C.dim, fontWeight: 500 }}>{r.source}</span>
              <span>{r.value}</span>
            </Chip>
          )
        })}
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: landscape ? s.left + 140 : 90,
          top: landscape ? s.top + h + 10 : s.top + h + 140,
          opacity: toast,
          transform: `translateY(${(1 - toast) * 60}px) scale(${0.92 + toast * 0.08})`,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '20px 30px',
          borderRadius: 24,
          background: 'rgba(5,46,22,0.9)',
          border: '1px solid rgba(34,197,94,0.5)',
          boxShadow:
            '0 30px 80px rgba(0,0,0,0.55), 0 0 60px rgba(34,197,94,0.22)',
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: landscape ? 32 : 38,
          color: '#dcfce7',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#052e16"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        Added to watchlist
      </div>
    </AbsoluteFill>
  )
}

/** A glass panel for the tracking scene. */
const Panel: React.FC<{
  at: number
  x: number
  y: number
  w: number
  tilt: number
  children: React.ReactNode
}> = ({ at, x, y, w, tilt, children }) => {
  const k = useSpring(at, 110, 17)
  const frame = useCurrentFrame()
  const bob = Math.sin((frame + at * 5) / 36) * 7
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + bob,
        width: w,
        opacity: Math.min(1, k * 1.4),
        transform: `translateY(${(1 - k) * 90}px) rotateZ(${tilt * k}deg) scale(${0.88 + k * 0.12})`,
        padding: 30,
        borderRadius: 30,
        background:
          'linear-gradient(160deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92))',
        border: '1px solid rgba(147,197,253,0.22)',
        boxShadow:
          '0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(96,165,250,0.12)',
        fontFamily: FONT,
        color: C.ink,
      }}
    >
      {children}
    </div>
  )
}

const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.sky,
}) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color,
    }}
  >
    {children}
  </div>
)

/** Beats 26-36. What you saved, what is next, what airs, what you watched. */
export const Track: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, sub } = useLayout()
  const progress = ease(frame, 70, 90, IN_OUT)
  const hours = Math.round(
    interpolate(frame, [190, 260], [0, 126], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: OUT_EXPO,
    })
  )
  const L = landscape
  const cx = L ? 820 : 70
  const cy = L ? 210 : 640
  return (
    <AbsoluteFill>
      <Backdrop glow={1.2} seed={4} />
      <div
        style={{
          position: 'absolute',
          left: L ? 130 : 90,
          top: L ? 360 : 230,
          width: L ? 600 : 900,
        }}
      >
        <Words
          text="Then keep track."
          from={4}
          size={heading}
          accent={['keep', 'track']}
        />
        <div style={{ height: sub * 0.8 }} />
        <Words
          text="Watchlist, history, and what airs next."
          from={18}
          size={sub}
          weight={500}
          color={C.dim}
          stagger={2}
        />
      </div>
      {/* Up next: the episode you are on, filling as you watch. */}
      <Panel at={20} x={cx} y={cy} w={L ? 560 : 600} tilt={-2}>
        <Label>Up next · S2 E4</Label>
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 20,
            alignItems: 'center',
          }}
        >
          <Poster i={2} w={110} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
              Breaking Bad
            </div>
            <div style={{ fontSize: 24, color: C.dim, marginTop: 6 }}>
              Down · 47 min
            </div>
            <div
              style={{
                marginTop: 20,
                height: 10,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${12 + progress * 70}%`,
                  height: '100%',
                  background: GRADIENT,
                  boxShadow: `0 0 18px ${C.blue}`,
                }}
              />
            </div>
          </div>
        </div>
      </Panel>
      {/* Watchlist: saved titles land one by one. */}
      <Panel
        at={60}
        x={L ? cx + 600 : cx + 120}
        y={L ? cy + 40 : cy + 330}
        w={L ? 470 : 760}
        tilt={2.5}
      >
        <Label>Watchlist</Label>
        <div style={{ display: 'flex', gap: 14, marginTop: 20 }}>
          {[0, 1, 3, 4].map((p, i) => {
            const k = ease(frame, 80 + i * 12, 20)
            return (
              <Poster
                key={p}
                i={p}
                w={L ? 92 : 150}
                style={{
                  opacity: k,
                  transform: `translateY(${(1 - k) * 30}px)`,
                }}
              />
            )
          })}
        </div>
      </Panel>
      {/* What airs next. */}
      <Panel
        at={120}
        x={L ? cx + 40 : cx}
        y={L ? cy + 400 : cy + 720}
        w={L ? 520 : 560}
        tilt={1.5}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'rgba(96,165,250,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.sky}
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
          </div>
          <div>
            <Label color={C.gold}>Airs Friday</Label>
            <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>
              New episode, on your list
            </div>
          </div>
        </div>
      </Panel>
      {/* Watch history. */}
      <Panel
        at={180}
        x={L ? cx + 620 : cx + 160}
        y={L ? cy + 330 : cy + 960}
        w={L ? 400 : 560}
        tilt={-2.5}
      >
        <Label>Watched this year</Label>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: -4,
              backgroundImage: GRADIENT,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {hours}
          </div>
          <div style={{ fontSize: 30, color: C.dim, fontWeight: 700 }}>
            hours
          </div>
        </div>
      </Panel>
    </AbsoluteFill>
  )
}

const PROMISES: Array<{ lead: string; accent: string }> = [
  { lead: '', accent: 'Free.' },
  { lead: 'Open', accent: 'source.' },
  { lead: 'No account', accent: 'needed.' },
]

/** Beats 36-42: three hits, three promises. */
export const Promise: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading } = useLayout()
  const size = heading * (landscape ? 1.4 : 1.05)
  const hit = Math.max(
    ...[0, 60, 120].map((at) =>
      interpolate(frame, [at, at + 2, at + 22], [0, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    )
  )
  return (
    <AbsoluteFill>
      <Backdrop glow={1 + hit * 1.2} seed={5} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: size * 0.18,
            alignItems: 'flex-start',
          }}
        >
          {PROMISES.map((p, i) => {
            const at = i * 60
            const k = ease(frame, at, 16)
            const latest =
              frame >= at && (i === PROMISES.length - 1 || frame < at + 60)
            return (
              <div
                key={p.accent}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: size * 0.28,
                  opacity: k * (latest ? 1 : 0.4),
                  transform: `scale(${1.25 - k * 0.25})`,
                  transformOrigin: 'left center',
                  filter: k < 1 ? `blur(${(1 - k) * 18}px)` : undefined,
                  fontFamily: FONT,
                  fontWeight: 900,
                  fontSize: size,
                  letterSpacing: -size * 0.045,
                  lineHeight: 1,
                }}
              >
                <svg
                  width={size * 0.6}
                  height={size * 0.6}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={C.sky}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {p.lead && <span style={{ color: C.ink }}>{p.lead}</span>}
                <span
                  style={{
                    backgroundImage: GRADIENT,
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    paddingBottom: '0.08em',
                  }}
                >
                  {p.accent}
                </span>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(191,219,254,0.35), transparent 60%)',
          opacity: hit * 0.6,
        }}
      />
    </AbsoluteFill>
  )
}

/** Beats 42-52. The app, on both screens, and where to find it. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, sub } = useLayout()
  const phone = useSpring(4, 90, 18)
  const browser = useSpring(0, 70, 20)
  const url = useSpring(40, 110, 16)
  const end = interpolate(frame, [270, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const float = Math.sin(frame / 40) * 8
  return (
    <AbsoluteFill>
      <Backdrop glow={1.2} seed={6} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: 'absolute',
            left: landscape ? 880 : -120,
            top: landscape ? 150 : 1030,
            transform: `translateX(${(1 - browser) * 300}px) rotateY(${landscape ? -24 : 18}deg) rotateX(6deg) scale(${landscape ? 0.95 : 0.85})`,
            opacity: browser * 0.9,
          }}
        >
          <Browser src={shot('home-desktop')} width={960} url={SITE} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: landscape ? 1390 : 560,
            top: landscape ? 200 + float : 940 + float,
            transform: `translateY(${(1 - phone) * 600}px) rotateZ(${landscape ? 4 : 6}deg)`,
          }}
        >
          <Phone src={shot('movie-mobile')} width={landscape ? 380 : 440} />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: landscape ? 130 : 90,
          top: landscape ? 250 : 200,
          width: landscape ? 760 : 900,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            opacity: ease(frame, 0, 20),
          }}
        >
          <Mark size={landscape ? 96 : 110} />
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: landscape ? 52 : 58,
              color: C.ink,
              letterSpacing: -1.5,
            }}
          >
            Reely
          </div>
        </div>
        <div style={{ height: 50 }} />
        <Words text="Find what to watch." from={10} size={heading * 0.82} />
        <Words
          text="Then keep track."
          from={22}
          size={heading * 0.82}
          accent={['keep', 'track']}
        />
        <div style={{ height: 56 }} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              opacity: url,
              transform: `translateY(${(1 - url) * 40}px)`,
              padding: 3,
              borderRadius: 26,
              background: GRADIENT,
              boxShadow: '0 0 60px rgba(96,165,250,0.4)',
            }}
          >
            <div
              style={{
                padding: '20px 38px',
                borderRadius: 23,
                background: '#050a1f',
                fontFamily: FONT,
                fontWeight: 900,
                fontSize: sub * 1.4,
                color: C.ink,
                letterSpacing: -1,
              }}
            >
              {SITE}
            </div>
          </div>
          <div style={{ opacity: ease(frame, 56, 18) }}>
            <Pill size={sub * 0.8}>Movies and TV · free · open source</Pill>
          </div>
        </div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: end }} />
    </AbsoluteFill>
  )
}
