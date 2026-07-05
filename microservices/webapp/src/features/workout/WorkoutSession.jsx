import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useSessionBundle, useSyncSet, useDeleteSet, setKey } from './hooks'
import { loadSwaps, saveSwap, clearSwaps, applySwaps, mergeExerciseOrder } from './swaps'
import { scheduleRestAlarm, cancelRestAlarm } from '../../lib/push'
import { getRestSeconds } from '../../lib/restPrefs'
import { useToast } from '../../lib/toastContext'
import ExerciseLogCard from './ExerciseLogCard'
import SwapSheet from './SwapSheet'
import RestTimer from './RestTimer'
import PlateCalculator from './PlateCalculator'
import { PageSkeleton } from '../../components/ui/Skeleton'
import BottomSheet from '../../components/ui/BottomSheet'
import ConfirmSheet from '../../components/ui/ConfirmSheet'
import Button from '../../components/ui/Button'
import StatTile from '../../components/ui/StatTile'

const TIMER_KEY = 'restTimerEndsAt'
const ACTIVE_SESSION_KEY = 'activeSession'

// No tonnage, no duration on the finish sheet — the house method runs on
// sets to failure and beating last time's reps; the rest is bloat (owner's
// words). PRs and the top set carry the celebration.

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

// Planned set rows are materialized as LOCAL drafts: visible and editable
// immediately, but nothing reaches the server until the lifter touches the
// row. That keeps abandoned workouts empty (deletable husks), keeps skipped
// exercises out of the record, and means '+ Add Set' is only for work
// beyond the plan.
function makeDraft(ex, sugg, setNumber) {
  const lastN = sugg?.last_sets?.find((ls) => ls.set_number === setNumber)
  const base = {
    draft: true,
    exercise_id: ex.exercise_id,
    exercise_name: ex.exercise_name,
    set_number: setNumber,
    reps: lastN?.reps ?? sugg?.suggested_reps ?? 8,
    // RIR is an outcome, not a plan: default to the house target (0), never
    // clone a previous row's rating.
    rir: sugg?.target_rir ?? 0,
    recorded: false,
  }
  if (ex.laterality === 'unilateral') {
    const left = lastN?.weight_left ?? sugg?.suggested_weight ?? 0
    const right = lastN?.weight_right ?? sugg?.suggested_weight ?? 0
    return { ...base, weight_left: left, weight_right: right, weight: Math.min(left, right) }
  }
  return { ...base, weight: sugg?.suggested_weight ?? lastN?.weight ?? 0 }
}

function restEndsAtISO(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function timerTargetFrom(seconds) {
  return Date.now() + seconds * 1000
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
  const location = useLocation()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { session, suggestions } = useSessionBundle(sessionId)
  const { syncSet } = useSyncSet(sessionId)
  const deleteSet = useDeleteSet(sessionId)

  // Editing a finished workout is a distinct mode: it never becomes the
  // "active workout", never re-celebrates on Finish, and exits back to the
  // read-only record. Survives a mid-edit reload via sessionStorage.
  const editKey = `editingSession:${sessionId}`
  const [editMode] = useState(() => location.state?.edit === true || sessionStorage.getItem(editKey) === '1')

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
  const [summaryNote, setSummaryNote] = useState('')
  const [swaps, setSwaps] = useState(() => loadSwaps(sessionId))
  const [swapFor, setSwapFor] = useState(null)
  // Draft rows are DERIVED at render (plan target minus synced rows), so
  // they need only one bit of real state: per-exercise adjustments (extra
  // rows added / drafts explicitly deleted). A draft gets its client_id at
  // graduation time — the moment it first syncs; `graduated` guards the
  // same slot from minting two UUIDs on back-to-back events.
  const [draftAdj, setDraftAdj] = useState({})
  const graduated = useRef(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [noteFor, setNoteFor] = useState(null)
  const [noteText, setNoteText] = useState('')

  const exerciseNote = useMutation({
    mutationKey: ['syncExerciseNote'],
    scope: { id: `session-${sessionId}` },
    onMutate: async (vars) => {
      queryClient.setQueryData(['session', sessionId], (old) => {
        if (!old) return old
        const others = (old.exerciseNotes || []).filter((n) => n.exercise_id !== vars.exerciseId)
        const next = vars.note.trim()
          ? [...others, { exercise_id: vars.exerciseId, note: vars.note.trim() }]
          : others
        return { ...old, exerciseNotes: next }
      })
    },
  })

  function startTimer(seconds) {
    const endsAt = timerTargetFrom(seconds)
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

  // Remember the in-progress session so Today can offer a resume banner —
  // but never while editing an already-finished workout.
  useEffect(() => {
    if (editMode) {
      sessionStorage.setItem(editKey, '1')
      return
    }
    const label = session.data?.session?.day_label
    if (label) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ id: sessionId, label }))
    }
  }, [sessionId, session.data, editMode, editKey])

  if (session.isError) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-danger">Could not load session.</p>
        <Button onClick={() => navigate('/')}>Back to Today</Button>
      </div>
    )
  }
  // Covers both the initial fetch and the pre-restore window of the
  // persisted cache, where the query is pending but not yet fetching.
  if (!session.data) {
    return <PageSkeleton />
  }

  const { session: meta, sets, dayExercises, exerciseNotes } = session.data
  const suggestionByExercise = new Map((suggestions.data || []).map((s) => [s.exercise_id, s]))
  const noteByExercise = new Map((exerciseNotes || []).map((n) => [n.exercise_id, n.note]))

  const exerciseOrder = mergeExerciseOrder(applySwaps(dayExercises, swaps), sets)
  const recordedCount = sets.filter((s) => s.recorded).length

  // Materialize the plan as derived draft rows: target_sets minus what's
  // already synced, adjusted by explicit deletes/extras. Drafts are pure
  // prefill — the first touch graduates one into a real (synced) set, which
  // shrinks the derived count by one, so rows never duplicate.
  function setsFor(exercise) {
    const exerciseId = exercise.exercise_id
    const synced = sets.filter((s) => s.exercise_id === exerciseId)
    const adj = draftAdj[exerciseId] || { removed: 0, extra: 0 }
    const target = exercise.target_sets ?? 2
    // Slot-stable numbering: the row list always aims for `wanted` slots and
    // drafts fill the SMALLEST set numbers not held by synced rows. A draft
    // graduating mid-edit therefore never renumbers or reorders its siblings
    // (which used to remount the input under the user's thumbs and eat
    // keystrokes — caught by the verification pass).
    const wanted = Math.max(0, target - adj.removed) + adj.extra
    const used = new Set(synced.map((s) => s.set_number))
    const sugg = suggestionByExercise.get(exerciseId)
    const lastSynced = synced[synced.length - 1]
    const drafts = []
    for (let n = 1; synced.length + drafts.length < wanted && n < wanted + 20; n++) {
      if (used.has(n)) continue
      const draft = makeDraft(exercise, sugg, n)
      // Extra sets copy the working weight/reps from the last synced row —
      // but never its RIR (that stays an outcome, entered per set).
      if (n > target && lastSynced) {
        if (exercise.laterality === 'unilateral' && lastSynced.weight_left != null) {
          draft.weight_left = lastSynced.weight_left
          draft.weight_right = lastSynced.weight_right
          draft.weight = Math.min(lastSynced.weight_left, lastSynced.weight_right)
        } else if (lastSynced.weight != null) {
          draft.weight = lastSynced.weight
        }
        if (lastSynced.reps != null) draft.reps = lastSynced.reps
      }
      drafts.push(draft)
    }
    return [...synced, ...drafts].sort((a, b) => a.set_number - b.set_number)
  }

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
    // Reset draft adjustments for the replaced slot; the swap target derives
    // fresh plan drafts automatically (its laterality rides the swap).
    setDraftAdj((a) => ({ ...a, [original.exercise_id]: undefined }))
    setSwaps(
      saveSwap(sessionId, original.exercise_id, {
        exercise_id: newEx.id,
        exercise_name: newEx.name,
        laterality: newEx.laterality,
      })
    )
    setSwapFor(null)
  }

  function graduate(draftSet, patch) {
    const slot = `${draftSet.exercise_id}:${draftSet.set_number}`
    const { draft: _draft, ...clean } = draftSet
    if (graduated.current.has(slot)) {
      // Second event before re-render (e.g. two keystrokes in one frame):
      // the slot already synced — re-target the live cache row instead of
      // minting a duplicate.
      const live = queryClient.getQueryData(['session', sessionId])
      const row = (live?.sets || []).find(
        (s) => s.exercise_id === draftSet.exercise_id && s.set_number === draftSet.set_number && s.client_id,
      )
      if (row) {
        syncSet({ ...clean, client_id: row.client_id, id: row.id, version: row.version, ...patch })
        return
      }
    }
    graduated.current.add(slot)
    // No draftAdj change here: the graduated row keeps occupying its slot in
    // the `wanted` count, so sibling drafts hold their numbers and positions.
    syncSet({ ...clean, client_id: crypto.randomUUID(), ...patch })
  }

  function addSet(exercise) {
    setDraftAdj((a) => {
      const adj = a[exercise.exercise_id] || { removed: 0, extra: 0 }
      return { ...a, [exercise.exercise_id]: { ...adj, extra: adj.extra + 1 } }
    })
  }

  function changeSet(set) {
    if (set.draft) {
      graduate(set, {})
      return
    }
    const prev = sets.find((s) => setKey(s) === setKey(set))
    if (prev?.recorded && set.recorded === false) {
      // Un-recording the set that started the rest clock: kill the clock.
      dismissTimer()
    }
    syncSet(set)
  }

  function recordSet(set) {
    const restSeconds = getRestSeconds()
    const patch = { recorded: true }
    if (restSeconds && !editMode) {
      patch.rest_ends_at = restEndsAtISO(restSeconds)
    }
    if (set.draft) {
      graduate(set, patch)
    } else {
      syncSet({ ...set, ...patch })
    }
    if (restSeconds && !editMode) startTimer(restSeconds)
  }

  function removeSet(set) {
    if (set.draft) {
      const exercise = exerciseOrder.find((e) => e.exercise_id === set.exercise_id)
      const target = exercise?.target_sets ?? 2
      setDraftAdj((a) => {
        const adj = a[set.exercise_id] || { removed: 0, extra: 0 }
        const next =
          set.set_number > target && adj.extra > 0
            ? { ...adj, extra: adj.extra - 1 }
            : { ...adj, removed: adj.removed + 1 }
        return { ...a, [set.exercise_id]: next }
      })
      return
    }
    if (set.recorded) {
      setConfirmDelete(set)
      return
    }
    dropExtraSlotFor(set)
    deleteSet.mutate(set)
  }

  // Deleting a synced row that lives in an extra (beyond-plan) slot should
  // also retire the slot, or the derived drafts would resurrect it.
  function dropExtraSlotFor(set) {
    const exercise = exerciseOrder.find((e) => e.exercise_id === set.exercise_id)
    const target = exercise?.target_sets ?? 2
    if (set.set_number > target) {
      setDraftAdj((a) => {
        const adj = a[set.exercise_id] || { removed: 0, extra: 0 }
        if (adj.extra === 0) return a
        return { ...a, [set.exercise_id]: { ...adj, extra: adj.extra - 1 } }
      })
    }
  }

  function openNote(exercise) {
    setNoteFor(exercise)
    setNoteText(noteByExercise.get(exercise.exercise_id) || '')
  }

  function saveNote() {
    const exercise = noteFor
    exerciseNote.mutate({ sessionId: Number(sessionId), exerciseId: exercise.exercise_id, note: noteText })
    setNoteFor(null)
    toast('Note saved')
  }

  // Finish = the celebration moment. Tally the recorded sets into a summary
  // sheet; the session actually closes when the sheet is dismissed.
  function finish() {
    if (editMode) {
      sessionStorage.removeItem(editKey)
      toast('Workout updated')
      navigate(`/sessions/${sessionId}`)
      return
    }
    const allSets = session.data?.sets || []
    const recorded = allSets.filter((s) => s.recorded)
    if (recorded.length === 0) {
      // Nothing logged at all: discard the husk so it never shows up as a
      // phantom workout. Unrecorded drafts are local-only and die with it.
      if (allSets.length === 0) {
        api.deleteSession(sessionId).catch(() => {})
      }
      closeOut()
      return
    }
    const best = recorded.reduce((b, s) => {
      const load = s.weight_left != null && s.weight_right != null ? Math.min(s.weight_left, s.weight_right) : s.weight || 0
      const e1rm = load * (1 + (s.reps || 0) / 30)
      return !b || e1rm > b.e1rm ? { set: s, e1rm } : b
    }, null)
    navigator.vibrate?.(60)
    const exerciseIds = [...new Set(recorded.map((s) => s.exercise_id))]
    const firstTimers = exerciseIds.filter((id) => {
      const sugg = suggestionByExercise.get(id)
      return sugg && !sugg.last_performance && !sugg.last_sets?.length
    }).length
    setSummary({
      sets: recorded.length,
      exercises: exerciseIds.length,
      best: best?.set || null,
      firstTimers,
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

  function saveSummaryNote() {
    const text = summaryNote.trim()
    if (text) api.updateSession(sessionId, { notes: text }).catch(() => {})
  }

  function closeOut() {
    saveSummaryNote()
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearSwaps(sessionId)
    dismissTimer()
    navigate('/')
  }

  function closeOutToSession() {
    saveSummaryNote()
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearSwaps(sessionId)
    dismissTimer()
    navigate(`/sessions/${sessionId}`)
  }

  // Minimize (not close): the session and rest timer stay live, and the
  // ActiveWorkoutBar mini-bar keeps it one tap away from every tab. In edit
  // mode the chevron simply returns to the record.
  function minimize() {
    if (editMode) {
      sessionStorage.removeItem(editKey)
      navigate(`/sessions/${sessionId}`)
      return
    }
    navigate('/')
  }

  function discardWorkout() {
    api.deleteSession(sessionId).catch(() => {})
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearSwaps(sessionId)
    dismissTimer()
    navigate('/')
  }

  const startedAtDate = meta?.performed_at ? new Date(meta.performed_at) : null

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={minimize}
            aria-label="Minimize workout"
            title={editMode ? 'Back to the workout record' : 'Minimize — keeps the workout going'}
            className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="font-display truncate text-[24px] font-semibold leading-tight text-ink">
              {meta?.day_label}
              {editMode && <span className="ml-2 align-middle rounded-full bg-wash px-2 py-0.5 text-[11px] font-medium text-accent">Editing</span>}
            </h2>
            <p className="text-xs text-ink-3">
              {startedAtDate &&
                `${startedAtDate.toLocaleDateString()} · ${startedAtDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
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
          {!editMode && recordedCount === 0 && (
            <button
              onClick={() => setConfirmDiscard(true)}
              className="min-h-11 rounded-btn px-2 text-xs font-medium text-ink-3 transition-colors active:text-danger"
            >
              Discard
            </button>
          )}
          <button
            onClick={finish}
            className="inline-flex min-h-11 items-center rounded-btn bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-all active:scale-[0.97] active:bg-accent-press"
          >
            {editMode ? 'Done editing' : 'Finish'}
          </button>
        </div>
      </div>

      {exerciseOrder.map((ex) => (
        <ExerciseLogCard
          key={ex.exercise_id}
          exercise={ex}
          suggestion={suggestionByExercise.get(ex.exercise_id)}
          sets={setsFor(ex)}
          sessionId={sessionId}
          note={noteByExercise.get(ex.exercise_id)}
          pastNotes={suggestionByExercise.get(ex.exercise_id)?.last_notes}
          onAddSet={addSet}
          onChangeSet={changeSet}
          onRecordSet={recordSet}
          onDeleteSet={removeSet}
          onOpenPlates={(weight) => setPlatesFor(weight)}
          onSwap={(exercise) => setSwapFor(exercise)}
          onEditNote={openNote}
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

      <ConfirmSheet
        open={!!confirmDelete}
        title="Delete this set?"
        body={confirmDelete ? `${confirmDelete.exercise_name} — set ${confirmDelete.set_number} is logged. This removes it from the record.` : ''}
        confirmLabel="Delete set"
        onConfirm={() => {
          dropExtraSlotFor(confirmDelete)
          deleteSet.mutate(confirmDelete)
        }}
        onClose={() => setConfirmDelete(null)}
      />

      <ConfirmSheet
        open={confirmDiscard}
        title="Discard this workout?"
        body="Nothing is logged yet — this deletes the workout entirely."
        confirmLabel="Discard"
        onConfirm={discardWorkout}
        onClose={() => setConfirmDiscard(false)}
      />

      <BottomSheet open={!!noteFor} onClose={() => setNoteFor(null)} title="Exercise note">
        {noteFor && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-3">
              {noteFor.exercise_name} — machine, seat, grip. Future you will want to know.
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              maxLength={2000}
              autoFocus
              placeholder="Panatta taken — used the Lifefitness, seat 4."
              className="w-full rounded-field border border-line-2 bg-raised p-3 text-sm text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <Button onClick={saveNote} className="w-full min-h-12">
              Save note
            </Button>
          </div>
        )}
      </BottomSheet>

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
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="sets" value={summary.sets} sub="to failure" />
              <StatTile label={summary.exercises === 1 ? 'exercise' : 'exercises'} value={summary.exercises} />
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
            {summary.prs?.length === 0 && summary.firstTimers > 0 && (
              <div className="rounded-field bg-wash px-3 py-2.5 text-[13px] text-ink-2">
                First time on the books for {summary.firstTimers === 1 ? 'one lift' : `${summary.firstTimers} lifts`} — these numbers are the ones to beat.
              </div>
            )}
            {summary.best && (
              <div className="flex items-center justify-between rounded-field bg-sunken px-3 py-2.5">
                <span className="text-[13px] font-medium text-ink-2">Top set</span>
                <span className="text-sm font-semibold text-ink">
                  {summary.best.exercise_name} ·{' '}
                  {summary.best.weight_left != null
                    ? `R ${summary.best.weight_right} / L ${summary.best.weight_left} kg × ${summary.best.reps}`
                    : `${summary.best.weight} kg × ${summary.best.reps}`}
                </span>
              </div>
            )}
            <textarea
              value={summaryNote}
              onChange={(e) => setSummaryNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="How did it go? Sleep, pump, pain — future you will want to know."
              className="w-full rounded-field border border-line-2 bg-raised p-3 text-sm text-ink placeholder:text-ink-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <div className="space-y-2">
              <Button onClick={closeOut} className="w-full min-h-12">
                Back to Today
              </Button>
              <Button variant="secondary" onClick={closeOutToSession} className="w-full min-h-12">
                View workout
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
