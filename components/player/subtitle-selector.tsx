'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Language {
  code: string
  name: string
}

interface SubtitleSelectorProps {
  languages: Language[]
  currentLang: string
  onLanguageChange: (code: string) => void
  isOpen: boolean
  onClose: () => void
}

export function SubtitleSelector({
  languages,
  currentLang,
  onLanguageChange,
  isOpen,
  onClose,
}: SubtitleSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredLanguages = languages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full right-0 mb-2 w-64 rounded-md bg-slate-900 border border-slate-700 shadow-lg text-white"
    >
      <div className="p-2 border-b border-slate-700">
        <input
          type="text"
          placeholder="Search language..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-800 text-sm p-2 rounded outline-none placeholder:text-slate-400"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700">
        {filteredLanguages.length === 0 && (
          <div className="p-2 text-sm text-center text-slate-400">
            No language found
          </div>
        )}
        {filteredLanguages.map((lang) => (
          <div
            key={lang.code}
            className={cn(
              'p-2 text-sm cursor-pointer rounded hover:bg-slate-800 transition-colors',
              currentLang === lang.code && 'bg-blue-600 hover:bg-blue-600'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onLanguageChange(lang.code)
            }}
          >
            {lang.name} ({lang.code})
          </div>
        ))}
      </div>
    </div>
  )
}
