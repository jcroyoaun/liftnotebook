import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useSessionBundle, useSyncSet, useDeleteSet, setKey } from './hooks'
import {
  loadSwaps, saveSwap, deleteSwap, loadAdds, saveAdds, loadRemovals, saveRemovals, clearPlanEdits,
  applySwaps, applyAdds, applyRemovals, mergeExerciseOrder, diffPlan, buildFuturePlan,
} from './swaps'
import { scheduleRestAlarm, cancelRestAlarm } from '../../lib/push'
import { getActiveSession } from '../../lib/activeSession'
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

// THE one view of a workout (owner's law): viewing, logging, editing the
// past, swapping/adding/removing exercises — it all happens here. Whether a
// structural change also becomes the plan is a single question asked once,
// at save time ("This workout only" / "All future workouts").
//
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
  const { syncSet, cancelPendingFor } = useSyncSet(sessionId)
  const deleteSet = useDeleteSet(sessionId)

  // Editing a finished workout is the same view in a distinct mode: it never
  // becomes the "active workout", never re-celebrates on Finish, and exits
  // back to wherever the lifter came from. Survives a mid-edit reload via
  // sessionStorage. Router state alone is NOT trusted: open-in-new-tab and
  // bookmarks drop it, and a finished workout landing in live mode would be
  // hijacked as the active one (mini-bar, rest timers, re-celebration) — so
  // a session with recorded work that isn't the tracked active session is
  // edit mode by default.
  const editKey = `editingSession:${sessionId}`
  const resolvedKey = `planScopeResolved:${sessionId}`
  const explicitEdit = location.state?.edit === true || sessionStorage.getItem(editKey) === '1'
  const exitTo = location.state?.from === 'history' ? '/history' : '/'

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
  const [adds, setAdds] = useState(() => loadAdds(sessionId))
  const [removals, setRemovals] = useState(() => loadRemovals(sessionId))
  const [swapFor, setSwapFor] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [scopePrompt, setScopePrompt] = useState(null)
  const [savingScope, setSavingScope] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
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

  // Data-driven edit-mode fallback, decided ONCE at first data arrival
  // (state adjusted during render — React restarts the pass, so effects
  // only ever see the settled value) so a live workout can't flip to edit
  // mid-set, plus the entry snapshot the save prompt diffs against: only
  // drift caused THIS visit may prompt — historical extra sets from weeks
  // ago must never re-ask, and "All future workouts" must never rewrite
  // today's template from a stale record.
  const [inferredEdit, setInferredEdit] = useState(null)
  if (session.data && inferredEdit === null) {
    const activeMatch = String(getActiveSession()?.id) === String(sessionId)
    setInferredEdit(!activeMatch && session.data.sets.some((s) => s.recorded))
  }
  const editMode = explicitEdit || inferredEdit === true
  const entryBaseline = useRef(null)
  useEffect(() => {
    if (!session.data || entryBaseline.current) return
    const counts = {}
    for (const s of session.data.sets) {
      if (s.recorded) counts[s.exercise_id] = (counts[s.exercise_id] || 0) + 1
    }
    entryBaseline.current = {
      counts,
      editsSig: JSON.stringify({
        swaps: loadSwaps(sessionId),
        adds: loadAdds(sessionId),
        removals: loadRemovals(sessionId),
      }),
    }
  }, [session.data, sessionId])

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

  // The one exercise list: plan + session adds, mapped through swaps, plus
  // cards resurrected from off-plan sets, minus session removals. Removals
  // filter AFTER the merge so a removed card stays gone even while its set
  // deletions are still in flight.
  const exerciseOrder = applyRemovals(
    mergeExerciseOrder(applySwaps(applyAdds(dayExercises, adds), swaps), sets),
    removals,
  )
  const recordedCount = sets.filter((s) => s.recorded).length

  function recordedCountsMap() {
    const m = new Map()
    for (const s of sets) {
      if (s.recorded) m.set(s.exercise_id, (m.get(s.exercise_id) || 0) + 1)
    }
    return m
  }

  // What the lifter committed to per exercise: recorded work, grown by
  // "+ Add Set" rows even when unrecorded — so editing the plan through this
  // view can raise a set target without logging fake sets.
  function effectiveCountsMap() {
    const m = recordedCountsMap()
    for (const ex of exerciseOrder) {
      const extra = draftAdj[ex.exercise_id]?.extra || 0
      if (extra > 0) {
        const want = (ex.target_sets ?? 2) + extra
        if (want > (m.get(ex.exercise_id) || 0)) m.set(ex.exercise_id, want)
      }
    }
    return m
  }

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

  // Swap the exercise in `swapFor` for `newEx` — session-local; the save
  // prompt decides later whether the plan follows. Swapping an exercise
  // that is itself a swap replacement rewrites the ORIGINAL slot's mapping
  // (chains collapse to source → latest, or the second swap would silently
  // never apply).
  function performSwap(newEx) {
    const original = swapFor
    const source = Object.entries(swaps).find(([, to]) => to.exercise_id === original.exercise_id)?.[0]
    const fromId = source ? Number(source) : original.exercise_id
    // Swapping IN something removed earlier cancels the removal, or the
    // replacement card would be filtered out on arrival.
    if (removals.includes(newEx.id)) {
      setRemovals(saveRemovals(sessionId, removals.filter((id) => id !== newEx.id)))
    }
    // Reset draft adjustments for the replaced slot; the swap target derives
    // fresh plan drafts automatically (its laterality rides the swap).
    setDraftAdj((a) => ({ ...a, [original.exercise_id]: undefined }))
    setSwaps(
      saveSwap(sessionId, fromId, {
        exercise_id: newEx.id,
        exercise_name: newEx.name,
        laterality: newEx.laterality,
      })
    )
    setSwapFor(null)
  }

  // Add an exercise beyond the plan. Re-adding something swapped away this
  // session undoes the swap; re-adding something removed cancels the
  // removal (and its swap pairing) — each path resurfaces the exercise
  // instead of silently doing nothing.
  function addExercise(newEx) {
    const id = newEx.id
    if (swaps[id]) {
      const pairedReplacement = swaps[id].exercise_id
      setSwaps(deleteSwap(sessionId, id))
      if (removals.length) {
        setRemovals(saveRemovals(sessionId, removals.filter((r) => r !== id && r !== pairedReplacement)))
      }
    } else if (removals.includes(id)) {
      const source = Object.entries(swaps).find(([, to]) => to.exercise_id === id)?.[0]
      const drop = new Set(source ? [id, Number(source)] : [id])
      setRemovals(saveRemovals(sessionId, removals.filter((r) => !drop.has(r))))
    } else {
      setAdds(
        saveAdds(sessionId, [
          ...adds,
          { exercise_id: id, exercise_name: newEx.name, laterality: newEx.laterality },
        ])
      )
    }
    setAddOpen(false)
  }

  function requestRemove(exercise) {
    setSwapFor(null)
    const recorded = sets.filter((s) => s.exercise_id === exercise.exercise_id && s.recorded)
    if (recorded.length > 0) {
      setConfirmRemove({ exercise, count: recorded.length })
      return
    }
    doRemove(exercise)
  }

  function doRemove(exercise) {
    const exerciseId = exercise.exercise_id
    // Silence pending writes FIRST (debounce timers, offline-queued
    // mutations) — otherwise one fires after the DELETE and upserts the set
    // right back. Then server rows go with the card; cache-only rows are
    // dropped locally and the removal filter keeps the card hidden if a
    // request already on the wire lands late.
    cancelPendingFor(exerciseId)
    for (const s of sets.filter((x) => x.exercise_id === exerciseId && x.id != null)) {
      deleteSet.mutate(s)
    }
    queryClient.setQueryData(['session', sessionId], (old) =>
      old ? { ...old, sets: old.sets.filter((x) => x.exercise_id !== exerciseId) } : old
    )
    if (adds.some((a) => a.exercise_id === exerciseId)) {
      // Removing a session-add just retires the add.
      setAdds(saveAdds(sessionId, adds.filter((a) => a.exercise_id !== exerciseId)))
    } else {
      // Removing a swapped-in exercise removes the underlying slot too, so
      // the original neither reappears nor escapes the save-time diff.
      const swapSource = Object.entries(swaps).find(([, to]) => to.exercise_id === exerciseId)?.[0]
      const ids = swapSource ? [exerciseId, Number(swapSource)] : [exerciseId]
      setRemovals(saveRemovals(sessionId, [...removals, ...ids]))
    }
    setDraftAdj((a) => ({ ...a, [exerciseId]: undefined }))
    setConfirmRemove(null)
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
    if (!editMode && prev?.recorded && set.recorded === false) {
      // Un-recording the set that started the rest clock: kill the clock.
      // Never in edit mode — the clock (and its push alarm) may belong to a
      // live workout minimized behind this one.
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

  function saveNotes() {
    setSavingNotes(true)
    api
      .updateSession(sessionId, { notes: notesDraft.trim() })
      .then((res) => {
        queryClient.setQueryData(['session', sessionId], (old) =>
          old ? { ...old, session: { ...old.session, ...res.session } } : old
        )
        setNotesOpen(false)
        toast('Notes saved', 'success')
      })
      .catch((err) => toast(err.message))
      .finally(() => setSavingNotes(false))
  }

  // Did this visit change anything structural? Edit mode prompts (and
  // toasts) only for drift the lifter caused NOW — a workout from weeks ago
  // whose extra sets predate this visit is history, not a pending question.
  function changedThisVisit() {
    const base = entryBaseline.current
    if (!base) return false
    const editsSig = JSON.stringify({ swaps, adds, removals })
    if (editsSig !== base.editsSig) return true
    return [...effectiveCountsMap().entries()].some(([id, n]) => n !== (base.counts[id] || 0))
  }

  // Finish/Done editing: if the workout drifted from the program as written,
  // ask ONCE whether the plan follows — then close out as usual.
  function finish() {
    const hasWork = sets.some((s) => s.recorded)
    const eligible = editMode ? changedThisVisit() : hasWork
    const changes = eligible
      ? diffPlan({ template: dayExercises, final: exerciseOrder, recordedCounts: effectiveCountsMap(), adds, removals })
      : null
    if (changes) {
      // An already-answered prompt (same drift) doesn't re-ask — repeat
      // Done-editing taps after "This workout only" would otherwise nag.
      const sig = JSON.stringify(changes.map((c) => c.label))
      if (sessionStorage.getItem(resolvedKey) !== sig) {
        setScopePrompt(changes)
        return
      }
    }
    completeFinish()
  }

  function resolveScope(applyForward) {
    if (!applyForward) {
      sessionStorage.setItem(resolvedKey, JSON.stringify(scopePrompt.map((c) => c.label)))
      setScopePrompt(null)
      completeFinish()
      return
    }
    setSavingScope(true)
    api
      .updateDayExercises(meta.training_day_id, {
        exercises: buildFuturePlan({
          template: dayExercises,
          final: exerciseOrder,
          recordedCounts: effectiveCountsMap(),
          adds,
          swaps,
        }),
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
        queryClient.invalidateQueries({ queryKey: ['suggestions', meta.training_day_id] })
        toast(`${meta.day_label} plan updated`, 'success')
        setScopePrompt(null)
        completeFinish()
      })
      .catch((err) => toast(err.message)) // stays open — "This workout only" still works offline
      .finally(() => setSavingScope(false))
  }

  // The celebration moment (or, in edit mode, a quiet exit). The session
  // actually closes when the summary sheet is dismissed.
  function completeFinish() {
    if (editMode) {
      const touched = changedThisVisit()
      // A plan-editing husk (Edit plan opens the logger on an on-demand
      // session) that never logged anything must not linger as a phantom
      // workout — same rule as abandoning a live session.
      if ((session.data?.sets || []).length === 0) {
        api.deleteSession(sessionId).catch(() => {})
      }
      sessionStorage.removeItem(editKey)
      sessionStorage.removeItem(resolvedKey)
      clearPlanEdits(sessionId)
      if (touched) toast('Workout updated')
      navigate(exitTo)
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
    setSummaryNote(meta?.notes || '')
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
    if (!text) return
    api.updateSession(sessionId, { notes: text }).catch(() => {})
    // Mirror into the cache so "View workout" (edit-in-place) shows the
    // note it just saved instead of the stale pre-finish value.
    queryClient.setQueryData(['session', sessionId], (old) =>
      old ? { ...old, session: { ...old.session, notes: text } } : old
    )
  }

  function closeOut() {
    saveSummaryNote()
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearPlanEdits(sessionId)
    sessionStorage.removeItem(resolvedKey)
    dismissTimer()
    navigate('/')
  }

  // "View workout" on the finish sheet: same page, same view — the sheet
  // drops and the logger flips into edit mode in place (clearing the active
  // marker makes the derived editMode true). Session-local plan edits stay
  // so the display doesn't shift under the lifter; they clear on exit.
  function closeOutToSession() {
    saveSummaryNote()
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    dismissTimer()
    setSummary(null)
    sessionStorage.setItem(editKey, '1')
  }

  // Minimize (not close): the session and rest timer stay live, and the
  // ActiveWorkoutBar mini-bar keeps it one tap away from every tab. In edit
  // mode the chevron simply goes back — uncommitted structural edits are
  // discarded ("Done editing" is the save point), or they'd haunt the
  // record as phantom cards forever.
  function minimize() {
    if (editMode) {
      sessionStorage.removeItem(editKey)
      sessionStorage.removeItem(resolvedKey)
      clearPlanEdits(sessionId)
      navigate(exitTo)
      return
    }
    navigate('/')
  }

  function discardWorkout() {
    api.deleteSession(sessionId).catch(() => {})
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    clearPlanEdits(sessionId)
    sessionStorage.removeItem(resolvedKey)
    dismissTimer()
    navigate('/')
  }

  const startedAtDate = meta?.performed_at ? new Date(meta.performed_at) : null
  const excludeIds = new Set(exerciseOrder.map((e) => e.exercise_id))

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            onClick={minimize}
            aria-label="Minimize workout"
            title={editMode ? 'Back' : 'Minimize — keeps the workout going'}
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

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="min-h-12 w-full rounded-card border border-dashed border-line-2 text-sm font-medium text-accent transition-colors active:bg-wash"
      >
        + Add exercise
      </button>

      <div className="rounded-card border border-line bg-card p-4 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Notes</h3>
          <button
            onClick={() => { setNotesDraft(meta?.notes || ''); setNotesOpen(true) }}
            className="min-h-11 px-2 py-1 text-[13px] font-medium text-accent"
          >
            {meta?.notes ? 'Edit notes' : 'Add notes'}
          </button>
        </div>
        {meta?.notes ? (
          <p className="whitespace-pre-wrap text-sm text-ink-2">{meta.notes}</p>
        ) : (
          <p className="text-sm text-ink-3">How did it go? Sleep, pump, pain — future you will want to know.</p>
        )}
      </div>

      <SwapSheet
        open={!!swapFor}
        exercise={swapFor}
        excludeIds={excludeIds}
        onPick={performSwap}
        onRemove={requestRemove}
        onClose={() => setSwapFor(null)}
      />

      <SwapSheet
        open={addOpen}
        mode="add"
        excludeIds={excludeIds}
        onPick={addExercise}
        onClose={() => setAddOpen(false)}
      />

      {/* Never in edit mode: the global rest clock belongs to the live
          workout — showing it here invites dismissing another workout's
          alarm. */}
      {!editMode && <RestTimer endsAt={timerEndsAt} onDismiss={dismissTimer} onAdjust={adjustTimer} />}
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
        open={!!confirmRemove}
        title="Remove this exercise?"
        body={
          confirmRemove
            ? `${confirmRemove.exercise.exercise_name} has ${confirmRemove.count} logged ${confirmRemove.count === 1 ? 'set' : 'sets'} in this workout — removing it deletes them.`
            : ''
        }
        confirmLabel="Remove exercise"
        onConfirm={() => doRemove(confirmRemove.exercise)}
        onClose={() => setConfirmRemove(null)}
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

      <BottomSheet open={notesOpen} onClose={() => setNotesOpen(false)} title="Session notes">
        <div className="space-y-4">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={5}
            maxLength={2000}
            autoFocus
            placeholder="Bench felt heavy, slept 5h. Swapped rows for pull-ups."
            className="w-full rounded-field border border-line-2 bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <Button onClick={saveNotes} disabled={savingNotes} className="w-full min-h-12">
            {savingNotes ? 'Saving…' : 'Save notes'}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!scopePrompt} onClose={() => setScopePrompt(null)} title="You went off-plan">
        {scopePrompt && (
          <div className="space-y-4">
            <p className="text-sm text-ink-2">This workout drifted from the {meta?.day_label} plan:</p>
            <ul className="space-y-1.5 rounded-field bg-sunken px-3 py-2.5">
              {scopePrompt.map((c) => (
                <li key={c.label} className="text-sm text-ink">
                  {c.label}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-ink-3">
              Keep it as a one-off, or make this the new {meta?.day_label} plan going forward?
            </p>
            <div className="space-y-2">
              <Button onClick={() => resolveScope(false)} disabled={savingScope} className="w-full min-h-12">
                This workout only
              </Button>
              <Button variant="secondary" onClick={() => resolveScope(true)} disabled={savingScope} className="w-full min-h-12">
                {savingScope ? 'Saving…' : 'All future workouts'}
              </Button>
            </div>
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
