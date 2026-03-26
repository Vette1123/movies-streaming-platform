'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = value.trim()
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  function handleClear() {
    setValue('')
    inputRef.current?.focus()
    router.push('/search')
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search movies &amp; TV shows…"
        className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-11 pr-10 text-sm placeholder:text-muted-foreground focus:border-white/30 focus:outline-none focus:ring-0"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-white"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}
