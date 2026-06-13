import { ImageResponse } from 'next/og'

import {
  loadInter,
  OG_INTER_GLYPHS_700,
  OG_INTER_GLYPHS_900,
} from './_fonts/load'

export const alt =
  'Reely — Watch movies & TV shows free. Discover, track, and stream.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const [interBlack, interBold] = await Promise.all([
    loadInter(900, OG_INTER_GLYPHS_900),
    loadInter(700, OG_INTER_GLYPHS_700),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#020514',
          padding: 24,
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 28,
            border: '1px solid rgba(96,165,250,0.25)',
            backgroundImage:
              'radial-gradient(150% 120% at 100% 0%, #1e3a8a 0%, #0c1e4d 35%, #060b1f 70%, #020514 100%)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -260,
              right: -180,
              width: 720,
              height: 720,
              background:
                'radial-gradient(circle, rgba(96,165,250,0.30), rgba(96,165,250,0) 65%)',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -240,
              left: -200,
              width: 620,
              height: 620,
              background:
                'radial-gradient(circle, rgba(59,130,246,0.10), rgba(59,130,246,0) 70%)',
              display: 'flex',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                'linear-gradient(90deg, rgba(148,163,184,0) 0%, rgba(148,163,184,0.35) 50%, rgba(148,163,184,0) 100%)',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                'linear-gradient(90deg, rgba(148,163,184,0) 0%, rgba(148,163,184,0.35) 50%, rgba(148,163,184,0) 100%)',
              display: 'flex',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '46px 64px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 999,
                border: '1px solid rgba(96,165,250,0.35)',
                background: 'rgba(30,58,138,0.25)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: '#60a5fa',
                  marginRight: 12,
                  boxShadow: '0 0 12px rgba(96,165,250,0.9)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  color: '#cbd5e1',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Free to stream
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 18,
                color: '#64748b',
                fontWeight: 700,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
              }}
            >
              reely.space
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              padding: '0 64px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                maxWidth: 720,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 188,
                  fontWeight: 900,
                  color: 'transparent',
                  letterSpacing: '-0.07em',
                  lineHeight: 0.95,
                  backgroundImage:
                    'linear-gradient(180deg, #ffffff 0%, #93c5fd 60%, #3b82f6 100%)',
                  backgroundClip: 'text',
                }}
              >
                Reely
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 38,
                  color: '#e2e8f0',
                  marginTop: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.012em',
                  lineHeight: 1.15,
                }}
              >
                Watch movies &amp; TV shows. Free.
              </div>

              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  color: '#94a3b8',
                  marginTop: 18,
                  fontWeight: 500,
                  lineHeight: 1.45,
                  maxWidth: 640,
                }}
              >
                Discover, track, and stream thousands of trending titles
                &mdash; no signup, no paywall.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                marginLeft: 24,
                marginRight: 8,
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="280"
                height="280"
                viewBox="0 0 280 280"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="55%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#0c1e4d" />
                  </linearGradient>
                  <radialGradient id="hl" cx="22%" cy="18%" r="55%">
                    <stop
                      offset="0%"
                      stopColor="#ffffff"
                      stopOpacity="0.55"
                    />
                    <stop
                      offset="55%"
                      stopColor="#ffffff"
                      stopOpacity="0.08"
                    />
                    <stop
                      offset="100%"
                      stopColor="#ffffff"
                      stopOpacity="0"
                    />
                  </radialGradient>
                  <radialGradient id="sh" cx="78%" cy="82%" r="55%">
                    <stop
                      offset="0%"
                      stopColor="#020514"
                      stopOpacity="0.5"
                    />
                    <stop
                      offset="100%"
                      stopColor="#020514"
                      stopOpacity="0"
                    />
                  </radialGradient>
                </defs>
                <rect
                  x="2"
                  y="2"
                  width="276"
                  height="276"
                  rx="46"
                  fill="none"
                  stroke="rgba(96,165,250,0.35)"
                  strokeWidth="1"
                />
                <rect
                  x="8"
                  y="8"
                  width="264"
                  height="264"
                  rx="42"
                  fill="url(#card)"
                />
                <rect
                  x="8"
                  y="8"
                  width="264"
                  height="264"
                  rx="42"
                  fill="url(#hl)"
                />
                <rect
                  x="8"
                  y="8"
                  width="264"
                  height="264"
                  rx="42"
                  fill="url(#sh)"
                />
                <rect
                  x="8.5"
                  y="8.5"
                  width="263"
                  height="263"
                  rx="41.5"
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                />
                <path
                  d="M 114 92 L 114 188 L 196 140 Z"
                  fill="#ffffff"
                />
              </svg>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 64px 46px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  color: '#64748b',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                }}
              >
                Made by
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  color: '#cbd5e1',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  marginLeft: 8,
                }}
              >
                mohamedgado.com
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  color: '#475569',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                Movies
              </div>
              <div
                style={{
                  display: 'flex',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: '#3b82f6',
                  marginLeft: 14,
                  marginRight: 14,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  color: '#475569',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                TV Shows
              </div>
              <div
                style={{
                  display: 'flex',
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: '#3b82f6',
                  marginLeft: 14,
                  marginRight: 14,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  color: '#475569',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                Trending
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interBlack, weight: 900, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    }
  )
}
