import { Trash } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface DeleteHistoryAlertProps {
  onDelete: () => void
}

export function DeleteHistoryAlert({ onDelete }: DeleteHistoryAlertProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Trash className="mr-2 size-4" />
          Clear history
        </Button>
      }
      title="Clear your entire watch history?"
      description="Every title and every episode you have marked as watched is removed, on this device and on every device signed in to your account. There is no undo."
      confirmLabel="Yes, clear history"
      Icon={Trash}
      onConfirm={onDelete}
    />
  )
}
