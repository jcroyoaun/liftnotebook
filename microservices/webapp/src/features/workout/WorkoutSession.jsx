import { useEffect, useState, useSyncExternalStore } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutationState } from '@tanstack/react-query'
import { useSessionBundle, useSyncSet, useDeleteSet } from './hooks'
import ExerciseLogCard from './ExerciseLogCard'
import RestTimer from './RestTimer'
import PlateCalculator from './PlateCalculator'
import { PageSkeleton } from '../../components/ui/Skeleton'
import BottomSheet from '../../components/ui/BottomSheet'
import Button from '../../components/ui/Button'
import StatTile from '../../components/ui/StatTile'

const REST_SECONDS = 180
const TIMER_KEY = 'restTimerEndsAt'
const ACTIVE_SESSION_KEY = 'activeSession'

function minutesSince(iso) {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
}

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
  const [summary, setSummary] = useState(null)

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

  // Finish = the celebration moment. Tally the recorded sets into a summary
  // sheet; the session actually closes when the sheet is dismissed.
  function finish() {
    const recorded = (session.data?.sets || []).filter((s) => s.recorded)
    if (recorded.length === 0) {
      closeOut()
      return
    }
    const volume = Math.round(recorded.reduce((kg, s) => kg + (s.weight || 0) * (s.reps || 0), 0))
    const best = recorded.reduce((b, s) => {
      const e1rm = (s.weight || 0) * (1 + (s.reps || 0) / 30)
      return !b || e1rm > b.e1rm ? { set: s, e1rm } : b
    }, null)
    const startedAt = session.data?.session?.performed_at
    const minutes = startedAt ? minutesSince(startedAt) : null
    navigator.vibrate?.(60)
    setSummary({
      sets: recorded.length,
      exercises: new Set(recorded.map((s) => s.exercise_id)).size,
      volume,
      minutes,
      best: best?.set || null,
    })
  }

  function closeOut() {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    dismissTimer()
    navigate('/')
  }

  // Minimize (not close): the session and rest timer stay live, and the
  // ActiveWorkoutBar mini-bar keeps it one tap away from every tab.
  function minimize() {
    navigate('/')
  }

  if (session.isError) {
    return <div className="py-12 text-center text-danger">Could not load session.</div>
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
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={minimize}
            aria-label="Minimize workout"
            title="Minimize — keeps the workout going"
            className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="font-display truncate text-[24px] font-semibold leading-tight text-ink">{meta?.day_label}</h2>
            <p className="text-xs text-ink-3">
              {meta?.performed_at && new Date(meta.performed_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(!online || pendingSets.length > 0) && (
            <span className="rounded-full bg-warn-wash px-2 py-1 text-[11px] font-medium text-warn" data-testid="sync-status">
              {online
                ? 'Syncing…'
                : pendingSets.length > 0
                  ? `Offline — ${pendingSets.length} pending`
                  : 'Offline'}
            </span>
          )}
          <button
            onClick={finish}
            className="inline-flex min-h-11 items-center rounded-btn bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-all active:scale-[0.97] active:bg-accent-press"
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

      <BottomSheet open={!!summary} onClose={closeOut} title="Workout complete">
        {summary && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ok-wash text-ok animate-stamp">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold leading-tight text-ink">
                  {meta?.day_label} — in the books.
                </p>
                <p className="text-[13px] text-ink-3">Another page in the notebook.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="sets" value={summary.sets} sub="to failure" />
              <StatTile label="volume" value={summary.volume} sub="kg lifted" />
              {summary.minutes != null
                ? <StatTile label="minutes" value={summary.minutes} />
                : <StatTile label="exercises" value={summary.exercises} />}
            </div>
            {summary.best && (
              <div className="flex items-center justify-between rounded-field bg-sunken px-3 py-2.5">
                <span className="text-[13px] font-medium text-ink-2">Top set</span>
                <span className="text-sm font-semibold text-ink">
                  {summary.best.exercise_name} · {summary.best.weight} kg × {summary.best.reps}
                </span>
              </div>
            )}
            <Button onClick={closeOut} className="w-full min-h-12">
              Back to Today
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
