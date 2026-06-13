import { ImageResponse } from 'next/og'

import { loadInter } from './_fonts/load'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const font = await loadInter(900, 'R')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage:
            'linear-gradient(140deg, #2563eb 0%, #1d4ed8 45%, #0c1e4d 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -36,
            left: -36,
            width: 160,
            height: 160,
            background:
              'radial-gradient(circle, rgba(147,197,253,0.55), rgba(147,197,253,0) 65%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -40,
            right: -40,
            width: 140,
            height: 140,
            background:
              'radial-gradient(circle, rgba(15,23,42,0.55), rgba(15,23,42,0) 65%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 140,
            fontWeight: 900,
            color: 'transparent',
            backgroundImage:
              'linear-gradient(180deg, #ffffff 0%, #dbeafe 60%, #93c5fd 100%)',
            backgroundClip: 'text',
            letterSpacing: '-0.08em',
            lineHeight: 1,
            marginTop: -4,
          }}
        >
          R
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Inter', data: font, weight: 900, style: 'normal' }],
    }
  )
}
