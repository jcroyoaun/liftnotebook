import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

function formatRange(m) {
  const start = new Date(m.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!m.ended_at) return `Started ${start}`
  const end = new Date(m.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

export default function MesocycleHistory() {
  const [mesocycles, setMesocycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api.getMesocycles()
      .then(d => setMesocycles(d.mesocycles || []))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(m) {
    try {
      await api.deleteMesocycle(m.id)
      setMesocycles(prev => prev.filter(x => x.id !== m.id))
      toast('Training block deleted', 'success')
    } catch (err) {
      toast(err.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Programs"
        subtitle="Your training blocks"
        action={
          <div className="flex items-center gap-2">
            <Link to="/programs/templates"
              className="inline-flex min-h-11 items-center rounded-btn border border-line-2 bg-card px-3.5 text-sm font-semibold text-ink-2 transition-all active:scale-[0.97] active:bg-sunken">
              Templates
            </Link>
            <Link to="/programs/new"
              className="inline-flex min-h-11 items-center rounded-btn bg-accent-solid px-3.5 text-sm font-semibold text-on-accent transition-all active:scale-[0.97] active:bg-accent-press">
              New block
            </Link>
          </div>
        }
      />

      {mesocycles.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-1 font-medium text-ink-2">No training blocks yet</p>
          <p className="text-sm text-ink-3">
            Create one to start logging workouts, or{' '}
            <Link to="/programs/templates" className="font-medium text-accent hover:underline">start from a template</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {mesocycles.map(m => (
            <div key={m.id} className="rounded-card border border-line bg-card px-4 py-3 shadow-card transition-colors active:bg-sunken">
              <div className="flex items-center justify-between gap-3">
                <Link to={`/programs/${m.id}/volume`} className="min-w-0 flex-1 py-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-ink">{m.name}</h3>
                    {!m.ended_at && (
                      <span className="shrink-0 rounded bg-ok-wash px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {m.days_per_week} days/week · {formatRange(m)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setConfirmTarget(m)}
                    aria-label={`delete ${m.name}`}
                    className="grid h-11 w-11 place-items-center rounded-full text-ink-4 transition-colors hover:bg-danger-wash hover:text-danger active:text-danger">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <svg className="h-4 w-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={!!confirmTarget}
        title={`Delete "${confirmTarget?.name}"?`}
        body="This permanently removes the block and every workout logged in it. This cannot be undone."
        confirmLabel="Delete block"
        onConfirm={() => handleDelete(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  )
}
