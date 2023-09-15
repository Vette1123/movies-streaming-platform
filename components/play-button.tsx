import React from 'react'

import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'

interface PlayButtonProps {
  onClick: () => void
}

export const PlayButton = ({ onClick }: PlayButtonProps) => {
  return (
    <div className="rounded-full bg-gradient-to-br from-purple-600 to-blue-500 text-center font-medium text-white transition-colors duration-500 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500">
      <Icons.playIcon
        onClick={onClick}
        className={cn('h-24 w-24 cursor-pointer')}
      />
    </div>
  )
}
