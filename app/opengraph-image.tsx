import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const alt = 'Reely — Movie & TV Show Tracker'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadFont(filename: string) {
  return readFile(join(process.cwd(), 'app', '_fonts', filename))
}

export default async function OpenGraphImage() {
  const [interBlack, interBold] = await Promise.all([
    loadFont('Inter-Black.woff'),
    loadFont('Inter-Bold.woff'),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000',
          display: 'flex',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-260px',
            right: '-220px',
            width: '900px',
            height: '900px',
            background:
              'radial-gradient(circle, rgba(245,165,36,0.28), rgba(245,165,36,0) 65%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-180px',
            left: '-160px',
            width: '600px',
            height: '600px',
            background:
              'radial-gradient(circle, rgba(245,165,36,0.10), rgba(245,165,36,0) 70%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '120px',
            paddingTop: '40px',
            paddingBottom: '40px',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderRight: '1px solid #141414',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: '#0a0a0a',
                border: '2px solid #1c1c1c',
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 90px',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 240,
              fontWeight: 900,
              color: 'transparent',
              letterSpacing: '-0.065em',
              lineHeight: 1,
              backgroundImage:
                'linear-gradient(180deg, #fafafa 0%, #f5a524 100%)',
              backgroundClip: 'text',
            }}
          >
            Reely
          </div>

          <div
            style={{
              display: 'flex',
              width: '160px',
              height: '6px',
              background: '#f5a524',
              marginTop: '36px',
              borderRadius: '3px',
            }}
          />

          <div
            style={{
              display: 'flex',
              fontSize: 42,
              color: '#a3a3a3',
              marginTop: '32px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            Movie &amp; TV Show Tracker
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '44px',
            right: '64px',
            display: 'flex',
            fontSize: 26,
            color: '#525252',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          reely.space
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
