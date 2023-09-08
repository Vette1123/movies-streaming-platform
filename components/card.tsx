import React from 'react'
import Image from 'next/image'
import { CalendarDays } from 'lucide-react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

export const Card = () => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="group relative">
          <Image
            src={`https://image.tmdb.org/t/p/w500/muDaKftykz9Nj1mhRheMdbuNI9Z.jpg`}
            alt="Movie"
            width={250}
            height={375}
            sizes="(max-width: 640px) 100vw, 250px"
            className="w-full cursor-pointer rounded-md object-cover shadow-xl"
          />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          {/* <Avatar>
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar> */}
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">@nextjs</h4>
            <p className="text-sm">
              The React Framework – created and maintained by @vercel.
            </p>
            <div className="flex items-center pt-2">
              <CalendarDays className="mr-2 h-4 w-4 opacity-70" />{' '}
              <span className="text-xs text-muted-foreground">
                Joined December 2021
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
