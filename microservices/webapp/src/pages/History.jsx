import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'

const PAGE_SIZE = 20

// "Sat Jul 4 · 6:12 PM" in the viewer's local timezone.
function formatRowDate(d) {
  const day = d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

// "Hack Squat, Single Leg Leg Press +3"
function exerciseSummary(names) {
  if (!names?.length) return ''
  const shown = names.slice(0, 2).join(', ')
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown
}

export default function History() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['mySessions'],
      queryFn: ({ pageParam }) => api.getMySessions(pageParam, PAGE_SIZE),
      initialPageParam: 1,
      getNextPageParam: (lastPage, pages) => {
        const total = lastPage.metadata?.total ?? 0
        const loaded = pages.reduce((n, p) => n + (p.sessions?.length ?? 0), 0)
        return loaded < total ? (lastPage.metadata?.page ?? pages.length) + 1 : undefined
      },
    })

  // Start Workout creates the session row up front, so abandoned empty
  // sessions exist server-side — only pages with logged work belong here.
  const sessions = (data?.pages ?? [])
    .flatMap((p) => p.sessions || [])
    .filter((s) => (s.recorded_sets ?? 0) > 0)

  // Show the block name per row only once history spans more than one block.
  const multiBlock = new Set(sessions.map((s) => s.mesocycle_id)).size > 1

  // Month group headers — the list arrives ordered performed_at DESC.
  const groups = []
  for (const s of sessions) {
    const label = new Date(s.performed_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    if (!groups.length || groups[groups.length - 1].label !== label) {
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(s)
  }

  return (
    <div className="space-y-5">
      <PageHeader title="History" subtitle="Every page of the notebook." />

      {isPending ? (
        <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-sm text-danger">Couldn't load your history.</p>
          <Button variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="font-display mb-2 text-[22px] font-semibold text-ink">Nothing logged yet</h2>
          <p className="mx-auto max-w-64 text-[15px] text-ink-3">
            Your first workout starts the story.
          </p>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">
                {g.label}
              </h3>
              <div className="space-y-2">
                {g.items.map((s) => (
                  <Link
                    key={s.id}
                    to={`/sessions/${s.id}`}
                    state={{ from: 'history' }}
                    className="block min-h-11 rounded-card border border-line bg-card px-4 py-3 shadow-card transition-all active:scale-[0.99] active:bg-sunken"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[15px] font-semibold text-ink">
                        {s.day_label}
                        {multiBlock && s.mesocycle_name && (
                          <span className="ml-2 text-[11px] font-normal text-ink-4">
                            {s.mesocycle_name}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-3 tabular-nums">
                        {formatRowDate(new Date(s.performed_at))}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="shrink-0 text-ink-2 tabular-nums">
                        {s.recorded_sets} {s.recorded_sets === 1 ? 'set' : 'sets'} ·{' '}
                        {Math.round(s.total_volume_kg ?? 0).toLocaleString('en-US')} kg
                      </span>
                      <span className="min-w-0 truncate text-ink-4">
                        {exerciseSummary(s.exercises)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {hasNextPage && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading more…' : 'Load more'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
