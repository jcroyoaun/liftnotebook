import { useEffect, useState, useSyncExternalStore } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutationState } from '@tanstack/react-query'
import { useSessionBundle, useSyncSet, useDeleteSet } from './hooks'
import ExerciseLogCard from './ExerciseLogCard'
import RestTimer from './RestTimer'
import PlateCalculator from './PlateCalculator'
import { PageSkeleton } from '../../components/ui/Skeleton'

const REST_SECONDS = 180
const TIMER_KEY = 'restTimerEndsAt'
const ACTIVE_SESSION_KEY = 'activeSession'

function subscribeOnline(cb) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export default function WorkoutSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { session, suggestions } = useSessionBundle(sessionId)
  const { syncSet } = useSyncSet(sessionId)
  const deleteSet = useDeleteSet(sessionId)

  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  const pendingSets = useMutationState({
    filters: { mutationKey: ['syncSet'], status: 'pending' },
    select: (m) => m.state.variables,
  })

  const [timerEndsAt, setTimerEndsAt] = useState(() => {
    const stored = Number(localStorage.getItem(TIMER_KEY))
    return stored > Date.now() ? stored : null
  })
  const [platesFor, setPlatesFor] = useState(null)

  function startTimer(seconds = REST_SECONDS) {
    const endsAt = Date.now() + seconds * 1000
    localStorage.setItem(TIMER_KEY, String(endsAt))
    setTimerEndsAt(endsAt)
  }

  function adjustTimer(deltaSeconds) {
    setTimerEndsAt((prev) => {
      const next = Math.max(Date.now(), (prev ?? Date.now()) + deltaSeconds * 1000)
      localStorage.setItem(TIMER_KEY, String(next))
      return next
    })
  }

  function dismissTimer() {
    localStorage.removeItem(TIMER_KEY)
    setTimerEndsAt(null)
  }

  // Remember the in-progress session so Today can offer a resume banner.
  useEffect(() => {
    const label = session.data?.session?.day_label
    if (label) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ id: sessionId, label }))
    }
  }, [sessionId, session.data])

  function finish() {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    dismissTimer()
    navigate('/')
  }

  if (session.isError) {
    return <div className="text-center py-12 text-red-500">Could not load session.</div>
  }
  // Covers both the initial fetch and the pre-restore window of the
  // persisted cache, where the query is pending but not yet fetching.
  if (!session.data) {
    return <PageSkeleton />
  }

  const { session: meta, sets, dayExercises } = session.data
  const suggestionByExercise = new Map((suggestions.data || []).map((s) => [s.exercise_id, s]))

  const exerciseOrder =
    dayExercises.length > 0
      ? dayExercises
      : [...new Map(sets.map((s) => [s.exercise_id, { exercise_id: s.exercise_id, exercise_name: s.exercise_name, target_sets: 2 }])).values()]

  function addSet(exercise, suggestion) {
    const existing = sets.filter((s) => s.exercise_id === exercise.exercise_id)
    const lastSet = existing[existing.length - 1]

    syncSet({
      client_id: crypto.randomUUID(),
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.exercise_name,
      set_number: existing.length + 1,
      weight: lastSet?.weight ?? suggestion?.suggested_weight ?? 0,
      reps: lastSet?.reps ?? suggestion?.suggested_reps ?? 8,
      rir: lastSet?.rir ?? suggestion?.target_rir ?? 0,
      recorded: false,
    })
  }

  function changeSet(set) {
    syncSet(set)
  }

  function recordSet(set) {
    syncSet({ ...set, recorded: true })
    startTimer()
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{meta?.day_label}</h2>
          <p className="text-xs text-slate-500">
            {meta?.performed_at && new Date(meta.performed_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(!online || pendingSets.length > 0) && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium" data-testid="sync-status">
              {online
                ? 'Syncing…'
                : pendingSets.length > 0
                  ? `Offline — ${pendingSets.length} pending`
                  : 'Offline'}
            </span>
          )}
          <button
            onClick={finish}
            className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg active:bg-green-700"
          >
            Finish
          </button>
        </div>
      </div>

      {exerciseOrder.map((ex) => (
        <ExerciseLogCard
          key={ex.exercise_id}
          exercise={ex}
          suggestion={suggestionByExercise.get(ex.exercise_id)}
          sets={sets.filter((s) => s.exercise_id === ex.exercise_id)}
          onAddSet={addSet}
          onChangeSet={changeSet}
          onRecordSet={recordSet}
          onDeleteSet={(set) => deleteSet.mutate(set)}
          onOpenPlates={(weight) => setPlatesFor(weight)}
        />
      ))}

      <RestTimer endsAt={timerEndsAt} onDismiss={dismissTimer} onAdjust={adjustTimer} />
      {platesFor != null && (
        <PlateCalculator open onClose={() => setPlatesFor(null)} initialWeight={platesFor} />
      )}
    </div>
  )
}
