'use client'

import type { FC, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  children: ReactNode
}

const Modal: FC<ModalProps> = ({ children }) => {
  const router = useRouter()
  const isMounted = useMounted()

  const handleOnOpenChange = (open: boolean) => {
    if (!open) {
      router.back()
    }
  }

  if (!isMounted) {
    return null
  }

  return (
    <Dialog open onOpenChange={handleOnOpenChange}>
      <DialogContent className="top-[50%] max-w-(--breakpoint-md)">
        <DialogHeader>
          <DialogTitle>Disclaimer</DialogTitle>
          <DialogDescription>
            Please read this disclaimer carefully before using the service
            operated by us.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-auto">{children}</div>
        <DialogFooter>
          <Button
            variant="default"
            className="text-secondary-foreground"
            onClick={() => router.back()}
          >
            Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default Modal
