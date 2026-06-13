import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const font = await readFile(
    join(process.cwd(), 'app', '_fonts', 'Inter-Black.woff')
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            background:
              'radial-gradient(circle, rgba(245,165,36,0.45), rgba(245,165,36,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 144,
            fontWeight: 900,
            color: 'transparent',
            backgroundImage:
              'linear-gradient(180deg, #fafafa 0%, #f5a524 100%)',
            backgroundClip: 'text',
            letterSpacing: '-0.09em',
            lineHeight: 1,
            marginLeft: -8,
          }}
        >
          R
        </div>
        <div
          style={{
            position: 'absolute',
            right: 28,
            bottom: 34,
            width: 0,
            height: 0,
            borderLeft: '26px solid #f5a524',
            borderTop: '17px solid transparent',
            borderBottom: '17px solid transparent',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 900, style: 'normal' }],
    }
  )
}
