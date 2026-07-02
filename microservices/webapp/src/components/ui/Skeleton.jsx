// Pulse-placeholder loading states, replacing bare "Loading..." text.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-line/60 ${className}`} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-28" />
    </div>
  )
}
