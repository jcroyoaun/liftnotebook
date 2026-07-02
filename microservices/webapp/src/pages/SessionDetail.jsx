import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import { PageSkeleton } from '../components/ui/Skeleton'
import { getActiveSession } from '../lib/activeSession'

// Read-only view of a logged workout: what was lifted, nothing editable.
// The active session gets a "Continue logging" escape hatch into the logger.
export default function SessionDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const activeSession = getActiveSession()
  const isActive = activeSession && String(activeSession.id) === String(id)

  useEffect(() => {
    api.getSession(id)
      .then(setData)
      .catch(() => setError(true))
  }, [id])

  if (error) return <div className="py-12 text-center text-danger">Could not load workout.</div>
  if (!data) return <PageSkeleton />

  const { session, sets = [] } = data

  // Group sets by exercise, preserving first-seen (logging) order.
  const byExercise = new Map()
  for (const s of sets) {
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { name: s.exercise_name, sets: [] })
    }
    byExercise.get(s.exercise_id).sets.push(s)
  }
  const exercises = [...byExercise.values()].map((ex) => ({
    ...ex,
    sets: [...ex.sets].sort((a, b) => a.set_number - b.set_number),
  }))
  const recordedCount = sets.filter((s) => s.recorded).length

  const dateLine = session.performed_at
    ? new Date(session.performed_at).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''

  return (
    <div className="space-y-4">
      <PageHeader
        title={session.day_label}
        subtitle={`${dateLine} · ${recordedCount} sets recorded`}
        backTo="/"
      />

      {isActive && (
        <Link
          to={`/workout/${id}`}
          className="flex items-center justify-between rounded-card bg-accent-solid px-4 py-3.5 text-on-accent shadow-raised transition-transform active:scale-[0.98]"
        >
          <span className="text-sm font-semibold">This workout is still in progress</span>
          <span className="text-sm font-semibold">Continue logging →</span>
        </Link>
      )}

      {exercises.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-1 font-medium text-ink-2">No sets in this workout</p>
          <p className="text-sm text-ink-3">Nothing was logged for this session.</p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div key={ex.name} className="overflow-hidden rounded-card border border-line bg-card shadow-card">
            <div className="border-b border-line px-4 py-3">
              <h3 className="text-[15px] font-semibold text-ink">{ex.name}</h3>
            </div>
            <div className="divide-y divide-line">
              {ex.sets.map((s) => (
                <div key={s.id ?? s.client_id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink-3">Set {s.set_number}</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-sm font-medium text-ink">
                      {s.weight} kg × {s.reps}
                    </span>
                    {s.recorded ? (
                      s.rir != null && (
                        <span className="text-[12px] text-ink-3">RIR {s.rir}</span>
                      )
                    ) : (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-3">not recorded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {session.notes && (
        <div className="rounded-card border border-line bg-card p-4 shadow-card">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Notes</h3>
          <p className="text-sm text-ink-2">{session.notes}</p>
        </div>
      )}
    </div>
  )
}
