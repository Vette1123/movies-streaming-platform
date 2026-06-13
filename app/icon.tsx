import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default async function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            fontWeight: 900,
            color: '#fafafa',
            letterSpacing: '-0.1em',
            lineHeight: 1,
            marginLeft: -2,
          }}
        >
          R
        </div>
        <div
          style={{
            position: 'absolute',
            right: 5,
            bottom: 6,
            width: 0,
            height: 0,
            borderLeft: '6px solid #f5a524',
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
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
