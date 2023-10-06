import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="container pb-16 text-sm text-slate-500">
      <div className="flex items-center justify-center">
        <p>
          Coded in{' '}
          <Link
            href="https://code.visualstudio.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visual Studio Code
          </Link>{' '}
          by{' '}
          <Link
            href="https://www.mohamedgado.info/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            yours
          </Link>{' '}
          truly. Built with{' '}
          <Link
            href="https://nextjs.org/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js
          </Link>{' '}
          and{' '}
          <Link
            href="https://tailwindcss.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind CSS
          </Link>
          , deployed with{' '}
          <Link
            href="https://vercel.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vercel
          </Link>
          , Using{' '}
          <Link
            href="https://vidsrc.to/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            VidSrc
          </Link>
          .{/* ,{' '} */}
          {/* <Link
            href="https://mywebb-mustafaarslankaya.vercel.app"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arslankaya &#10084;
          </Link> */}
        </p>
      </div>
    </footer>
  )
}
