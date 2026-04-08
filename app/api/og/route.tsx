import { ImageResponse } from 'next/og'
import { type NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const title = searchParams.get('title') ?? 'Reely'
    const description =
      searchParams.get('description') ?? 'Reely is a movie and tv show tracker.'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            backgroundColor: '#09090b',
            padding: '60px',
          }}
        >
          {/* Background accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              background:
                'radial-gradient(ellipse at 20% 50%, rgba(220,38,38,0.15) 0%, transparent 60%)',
            }}
          />

          {/* Logo / Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#dc2626',
                marginRight: '12px',
              }}
            />
            <span
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.5px',
              }}
            >
              Reely
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-2px',
              marginBottom: '24px',
              maxWidth: '900px',
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: '28px',
              color: '#a1a1aa',
              lineHeight: 1.4,
              maxWidth: '800px',
            }}
          >
            {description}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e) {
    console.error(e)
    return new Response('Failed to generate OG image', { status: 500 })
  }
}
