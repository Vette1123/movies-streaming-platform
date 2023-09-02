import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { apiConfig } from './tmdbConfig'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function getImageURL(path: string) {
  return `${apiConfig.originalImage(path)}`
}

export { cn, getImageURL }
