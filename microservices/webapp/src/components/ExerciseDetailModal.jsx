import { useEffect, useState } from 'react'
import { api } from '../api/client'
import BottomSheet from './ui/BottomSheet'
import MuscleMap from './MuscleMap'
import ExerciseArt from './ExerciseArt'
import { Skeleton } from './ui/Skeleton'

function sectionTargets(targets, targetType) {
  return (targets || []).filter(target => target.target_type === targetType)
}

// Exercise detail as a bottom sheet, matching every other overlay in the app.
export default function ExerciseDetailModal({ exerciseId, onClose }) {
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Mounted with key={exerciseId}, so state always starts fresh per exercise
  // and the effect only fetches.
  useEffect(() => {
    let ignore = false

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
    <BottomSheet open onClose={onClose} title={exercise?.name || 'Exercise details'}>
      <div className="space-y-4">
        {exercise && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sunken px-2.5 py-1 capitalize text-ink-2">
              {exercise.type}
            </span>
            {exercise.movement_pattern && (
              <span className="rounded-full bg-wash px-2.5 py-1 font-medium text-accent">
                {exercise.movement_pattern}
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg bg-danger-wash px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {!loading && !error && (
          <>
            <div className="mx-auto max-w-40 rounded-field bg-sunken/60 p-2">
              <ExerciseArt exerciseId={exerciseId} className="h-auto w-full" />
            </div>
            <MuscleMap targets={exercise?.targets} />
            <TargetSection title="Primary Muscles" targets={primaryTargets} emptyLabel="No primary muscles configured." />
            <TargetSection title="Secondary Muscles" targets={secondaryTargets} emptyLabel="No secondary muscles configured." />

            {primaryTargets.length === 0 && secondaryTargets.length === 0 && (
              <p className="rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
                No target muscles are configured for this exercise yet.
              </p>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function TargetSection({ title, targets, emptyLabel }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h4>

      {targets.length === 0 ? (
        <p className="text-sm text-ink-3">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {targets.map(target => (
            <div key={`${target.target_type}-${target.muscle_id}`} className="flex items-center justify-between rounded-field bg-sunken px-3 py-2.5">
              <span className="text-sm font-medium text-ink">{target.muscle_name}</span>
              <span className="text-xs capitalize text-ink-3">{target.body_part}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
