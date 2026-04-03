import { useEffect, useState } from 'react'
import { api } from '../api/client'

function sectionTargets(targets, targetType) {
  return (targets || []).filter(target => target.target_type === targetType)
}

export default function ExerciseDetailModal({ exerciseId, onClose }) {
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    setExercise(null)
    setError('')
    setLoading(true)

    api.getExercise(exerciseId)
      .then(data => {
        if (!ignore) {
          setExercise(data.exercise)
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })

    return () => { ignore = true }
  }, [exerciseId])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const primaryTargets = sectionTargets(exercise?.targets, 'primary')
  const secondaryTargets = sectionTargets(exercise?.targets, 'secondary')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close exercise details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
      />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {exercise?.name || 'Exercise details'}
            </h3>
            {exercise && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  {exercise.type}
                </span>
                {exercise.movement_pattern && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                    {exercise.movement_pattern}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {loading && <p className="text-sm text-slate-400">Loading target muscles...</p>}

          {!loading && error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && (
            <>
              <TargetSection title="Primary Muscles" targets={primaryTargets} emptyLabel="No primary muscles configured." />
              <TargetSection title="Secondary Muscles" targets={secondaryTargets} emptyLabel="No secondary muscles configured." />

              {primaryTargets.length === 0 && secondaryTargets.length === 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  No target muscles are configured for this exercise yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TargetSection({ title, targets, emptyLabel }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>

      {targets.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {targets.map(target => (
            <div key={`${target.target_type}-${target.muscle_id}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-800">{target.muscle_name}</span>
              <span className="text-xs capitalize text-slate-500">{target.body_part}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
