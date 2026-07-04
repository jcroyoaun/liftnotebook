import { useEffect, useState, useSyncExternalStore } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useSessionBundle, useSyncSet, useDeleteSet } from './hooks'
import { loadSwaps, saveSwap, clearSwaps, applySwaps, mergeExerciseOrder } from './swaps'
import { scheduleRestAlarm, cancelRestAlarm } from '../../lib/push'
import ExerciseLogCard from './ExerciseLogCard'
import SwapSheet from './SwapSheet'
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

// Best-effort PR check: for each exercise trained, compare this session's
// best e1RM point against the best of every earlier session. Server history
// already includes the just-synced sets; offline it simply resolves to [].
async function detectPRs(sessionId, exerciseIds, exerciseNames) {
  const checks = exerciseIds.map(async (exerciseId) => {
    const data = await api.getE1RMProgress(exerciseId)
    const points = data.progress || []
    const current = points.find((p) => p.session_id === sessionId)
    if (!current) return null
    const priorBest = points
      .filter((p) => p.session_id !== sessionId)
      .reduce((best, p) => Math.max(best, p.avg_e1rm), 0)
    if (priorBest <= 0 || current.avg_e1rm <= priorBest) return null
    return {
      exercise_id: exerciseId,
      exercise_name: exerciseNames.get(exerciseId),
      e1rm: current.avg_e1rm,
      previous: priorBest,
    }
  })
  const results = await Promise.allSettled(checks)
  return results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value)
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
  const queryClient = useQueryClient()
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
  const [swaps, setSwaps] = useState(() => loadSwaps(sessionId))
  const [swapFor, setSwapFor] = useState(null)

  function startTimer(seconds = REST_SECONDS) {
    const endsAt = Date.now() + seconds * 1000
    localStorage.setItem(TIMER_KEY, String(endsAt))
    setTimerEndsAt(endsAt)
    scheduleRestAlarm(seconds)
  }

  function adjustTimer(deltaSeconds) {
    const next = Math.max(Date.now(), (timerEndsAt ?? Date.now()) + deltaSeconds * 1000)
    localStorage.setItem(TIMER_KEY, String(next))
    setTimerEndsAt(next)
    scheduleRestAlarm(Math.max(1, Math.round((next - Date.now()) / 1000)))
  }

  function dismissTimer() {
    localStorage.removeItem(TIMER_KEY)
    setTimerEndsAt(null)
    cancelRestAlarm()
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
    const allSets = session.data?.sets || []
    const recorded = allSets.filter((s) => s.recorded)
    if (recorded.length === 0) {
      // Nothing logged at all: discard the husk so it never shows up as a
      // phantom workout. Unrecorded drafts keep the session alive.
      if (allSets.length === 0) {
        api.deleteSession(sessionId).catch(() => {})
      }
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
    const exerciseIds = [...new Set(recorded.map((s) => s.exercise_id))]
    setSummary({
      sets: recorded.length,
      exercises: exerciseIds.length,
      volume,
      minutes,
      best: best?.set || null,
      prs: null, // null = still checking; [] = checked, none
    })

    const exerciseNames = new Map(recorded.map((s) => [s.exercise_id, s.exercise_name]))
    detectPRs(Number(sessionId), exerciseIds, exerciseNames)
      .then((prs) => {
        if (prs.length > 0) navigator.vibrate?.([40, 60, 40])
        setSummary((prev) => (prev ? { ...prev, prs } : prev))
      })
      .catch(() => setSummary((prev) => (prev ? { ...prev, prs: [] } : prev)))
  }

  function closeOut() {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearSwaps(sessionId)
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

  const exerciseOrder = mergeExerciseOrder(applySwaps(dayExercises, swaps), sets)

  // Swap the exercise in `swapFor` for `newEx`. "Persist" additionally
  // rewrites the day template (same slot, same targets) for future weeks.
  async function performSwap(newEx, persist) {
    const original = swapFor
    if (persist) {
      const rewritten = dayExercises.map((e) =>
        e.exercise_id === original.exercise_id ? { ...e, exercise_id: newEx.id } : e
      )
      await api.updateDayExercises(meta.training_day_id, {
        exercises: rewritten.map((e, i) => ({
          exercise_id: e.exercise_id,
          position: i + 1,
          target_sets: e.target_sets,
          target_rep_range_low: e.target_rep_range_low,
          target_rep_range_high: e.target_rep_range_high,
          target_rir: e.target_rir,
        })),
      })
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['suggestions', meta.training_day_id] })
    }
    setSwaps(saveSwap(sessionId, original.exercise_id, { exercise_id: newEx.id, exercise_name: newEx.name }))
    setSwapFor(null)
  }

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
          onSwap={(exercise) => setSwapFor(exercise)}
        />
      ))}

      <SwapSheet
        open={!!swapFor}
        exercise={swapFor}
        excludeIds={new Set(exerciseOrder.map((e) => e.exercise_id))}
        canPersist={!!swapFor && dayExercises.some((e) => e.exercise_id === swapFor.exercise_id)}
        onSwap={performSwap}
        onClose={() => setSwapFor(null)}
      />

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
            {summary.prs?.length > 0 && (
              <div className="space-y-1.5">
                {summary.prs.map((pr) => (
                  <div key={pr.exercise_id} className="flex items-center gap-2.5 rounded-field bg-ok-wash px-3 py-2.5 animate-stamp">
                    <span aria-hidden="true">🏆</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ok">
                        New best: {pr.exercise_name}
                      </div>
                      <div className="text-[12px] text-ink-3 tabular-nums">
                        {Math.round(pr.e1rm * 10) / 10} kg e1RM · was {Math.round(pr.previous * 10) / 10}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
