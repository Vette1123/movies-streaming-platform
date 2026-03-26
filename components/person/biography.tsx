'use client'

import React, { useState } from 'react'

const MAX_LENGTH = 500

export function Biography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > MAX_LENGTH

  return (
    <div>
      <p className="max-w-2xl text-sm leading-relaxed text-white/70 lg:text-base">
        {isLong && !expanded ? text.slice(0, MAX_LENGTH) + '…' : text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
