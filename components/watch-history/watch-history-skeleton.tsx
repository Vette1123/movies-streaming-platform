import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function WatchedItemCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-2/3 w-full" />
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-2 flex items-center">
          <Skeleton className="mr-2 size-4 rounded-full" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </CardContent>
    </Card>
  )
}
