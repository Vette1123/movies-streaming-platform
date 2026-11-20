// Design source for /opengraph-image.png.
//
// Private folder (leading underscore), not a route. `pnpm og:build` renders it
// once and the PNG is committed at `public/opengraph-image.png`, so an unfurl
// never touches the Worker (WhatsApp scrapes once, with no retry).
//
// To change the card: edit OG_COPY or the JSX, run `pnpm og:build`, LOOK at
// the PNG, commit it. Copy follows the launch-kit rule (docs/marketing/
// launch-kit.md): the catalogue and the tracking, never a streaming pitch.
// tests/og-card.test.ts checks the wording and that every character is in the
// bundled font subset.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { interFonts } from '../_fonts/load'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export const OG_COPY = {
  badge: 'Open source',
  label: 'Movie & TV tracker',
  statement: 'Find what to watch.',
  promise: 'Then keep track.',
  tagline:
    'Trending rails, four rating sources on every title, deep filters, a watchlist and a watch history.',
  rating: '8.6',
  toast: 'Added to watchlist',
  upNext: 'Up next · S2 E4',
  chips: ['Movies', 'TV shows', 'Every rating'],
  host: 'reely.space',
}

const BLUE_GRADIENT =
  'linear-gradient(100deg, #93c5fd 0%, #60a5fa 45%, #818cf8 100%)'

/** Poster art: drawn gradients, never real artwork, so the card owns every pixel. */
const POSTERS = [
  {
    art: 'linear-gradient(160deg, #f59e0b 0%, #b45309 45%, #1c0a02 100%)',
    tilt: -11,
    x: 0,
    y: 34,
  },
  {
    art: 'linear-gradient(160deg, #a78bfa 0%, #4c1d95 50%, #0b0420 100%)',
    tilt: 10,
    x: 196,
    y: 30,
  },
]

function brandMark() {
  const png = readFileSync(
    join(process.cwd(), 'public', 'android-chrome-192x192.png')
  )
  return `data:image/png;base64,${png.toString('base64')}`
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  )
}

function Check({ size, stroke }: { size: number; stroke: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

/** Title and meta lines on a poster, as bars: the shape of a card, no words to translate. */
function PosterLines({ width }: { width: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          width,
          height: 12,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.85)',
        }}
      />
      <div
        style={{
          display: 'flex',
          width: width * 0.55,
          height: 9,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.45)',
        }}
      />
    </div>
  )
}

function SidePoster({ art, tilt, x, y }: (typeof POSTERS)[number]) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 190,
        height: 285,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 18,
        borderRadius: 22,
        backgroundImage: art,
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
        transform: `rotate(${tilt}deg)`,
        opacity: 0.88,
      }}
    >
      <PosterLines width={110} />
    </div>
  )
}

/** The front poster: the title a visitor just found, with its rating and a play button. */
function HeroPoster() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 92,
        top: 0,
        width: 220,
        height: 330,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 18,
        borderRadius: 26,
        backgroundImage:
          'radial-gradient(circle at 70% 18%, rgba(147,197,253,0.65) 0%, rgba(147,197,253,0) 45%), linear-gradient(165deg, #2563eb 0%, #1e3a8a 50%, #050a1f 100%)',
        border: '1px solid rgba(147,197,253,0.45)',
        boxShadow:
          '0 40px 80px rgba(0,0,0,0.6), 0 0 70px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 20,
            fontWeight: 900,
            color: '#fef3c7',
            background: 'rgba(2,5,20,0.6)',
            border: '1px solid rgba(251,191,36,0.4)',
          }}
        >
          <Star size={18} />
          {OG_COPY.rating}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.16)',
            border: '1.5px solid rgba(255,255,255,0.55)',
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </div>
      </div>
      <PosterLines width={140} />
    </div>
  )
}

function UpNext() {
  return (
    <div
      style={{
        position: 'absolute',
        right: -18,
        top: 74,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        padding: '12px 16px',
        borderRadius: 16,
        fontSize: 17,
        fontWeight: 700,
        color: '#dbeafe',
        background: 'rgba(8,14,38,0.92)',
        border: '1px solid rgba(96,165,250,0.35)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}
    >
      {OG_COPY.upNext}
      <div
        style={{
          display: 'flex',
          width: 150,
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 96,
            height: 6,
            borderRadius: 999,
            backgroundImage: BLUE_GRADIENT,
          }}
        />
      </div>
    </div>
  )
}

function WatchlistToast() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 4,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 18px',
        borderRadius: 16,
        fontSize: 18,
        fontWeight: 700,
        color: '#dcfce7',
        background: 'rgba(6,26,20,0.95)',
        border: '1px solid rgba(74,222,128,0.42)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.55)',
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#22c55e',
        }}
      >
        <Check size={15} stroke="#052e16" />
      </div>
      {OG_COPY.toast}
    </div>
  )
}

/** What the product does, drawn: a found title, fanned between two more, then tracked. */
function Scene() {
  return (
    <div
      style={{ display: 'flex', position: 'relative', width: 390, height: 370 }}
    >
      {POSTERS.map((poster) => (
        <SidePoster key={poster.art} {...poster} />
      ))}
      <HeroPoster />
      <UpNext />
      <WatchlistToast />
    </div>
  )
}

function Chips() {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {OG_COPY.chips.map((label) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 19,
            fontWeight: 700,
            color: 'rgba(226,232,240,0.85)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Check size={16} stroke="#60a5fa" />
          {label}
        </div>
      ))}
    </div>
  )
}

export function openGraphCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        fontFamily: 'Inter',
        color: '#f8fafc',
        background: '#020514',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          background:
            'radial-gradient(ellipse 680px 460px at 0% 0%, rgba(37,99,235,0.34) 0%, transparent 70%), radial-gradient(ellipse 620px 520px at 100% 100%, rgba(99,102,241,0.3) 0%, transparent 70%), radial-gradient(ellipse 420px 320px at 80% 30%, rgba(59,130,246,0.22) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          opacity: 0.5,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '52px 60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori, not the DOM */}
            <img
              src={brandMark()}
              width={54}
              height={54}
              alt=""
              style={{ borderRadius: 14 }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: -1,
              }}
            >
              Reely
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 999,
              fontSize: 19,
              fontWeight: 700,
              color: '#bfdbfe',
              background: 'rgba(37,99,235,0.14)',
              border: '1px solid rgba(96,165,250,0.4)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 9,
                height: 9,
                borderRadius: 999,
                background: '#60a5fa',
                boxShadow: '0 0 12px #60a5fa',
              }}
            />
            {OG_COPY.badge}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              width: 650,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2.6,
                textTransform: 'uppercase',
                color: '#93c5fd',
              }}
            >
              {OG_COPY.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 66,
                  fontWeight: 900,
                  letterSpacing: -2.4,
                  lineHeight: 1.05,
                }}
              >
                {OG_COPY.statement}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 66,
                  fontWeight: 900,
                  letterSpacing: -2.4,
                  lineHeight: 1.05,
                  color: 'transparent',
                  backgroundImage: BLUE_GRADIENT,
                  backgroundClip: 'text',
                }}
              >
                {OG_COPY.promise}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 500,
                lineHeight: 1.45,
                color: 'rgba(203,213,225,0.82)',
                width: 590,
              }}
            >
              {OG_COPY.tagline}
            </div>
          </div>
          <Scene />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Chips />
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 700,
              color: 'rgba(148,163,184,0.75)',
            }}
          >
            {OG_COPY.host}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function buildOpenGraphImageInput() {
  return { jsx: openGraphCard(), options: { ...OG_SIZE, fonts: interFonts() } }
}
