// Session-scoped plan edits: swaps, added exercises, removed exercises.
// All three are device-local by design: they live in localStorage keyed by
// session and evaporate when the workout closes. Choosing "All future
// workouts" on the save prompt additionally rewrites the day template
// server-side; the local entries then simply stop matching anything.

const swapsKey = (sessionId) => `sessionSwaps:${sessionId}`
const addsKey = (sessionId) => `sessionAdds:${sessionId}`
const removalsKey = (sessionId) => `sessionRemovals:${sessionId}`

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function loadSwaps(sessionId) {
  return loadJSON(swapsKey(sessionId), {})
}

export function saveSwap(sessionId, fromExerciseId, to) {
  const swaps = loadSwaps(sessionId)
  swaps[fromExerciseId] = to
  localStorage.setItem(swapsKey(sessionId), JSON.stringify(swaps))
  return swaps
}

// Undoing a swap (re-adding the original) deletes the mapping so the
// template exercise surfaces again.
export function deleteSwap(sessionId, fromExerciseId) {
  const swaps = loadSwaps(sessionId)
  delete swaps[fromExerciseId]
  localStorage.setItem(swapsKey(sessionId), JSON.stringify(swaps))
  return swaps
}

export function loadAdds(sessionId) {
  return loadJSON(addsKey(sessionId), [])
}

export function saveAdds(sessionId, adds) {
  localStorage.setItem(addsKey(sessionId), JSON.stringify(adds))
  return adds
}

export function loadRemovals(sessionId) {
  return loadJSON(removalsKey(sessionId), [])
}

export function saveRemovals(sessionId, removals) {
  localStorage.setItem(removalsKey(sessionId), JSON.stringify(removals))
  return removals
}

export function clearPlanEdits(sessionId) {
  localStorage.removeItem(swapsKey(sessionId))
  localStorage.removeItem(addsKey(sessionId))
  localStorage.removeItem(removalsKey(sessionId))
}

// applySwaps maps the day plan through the swap table. Targets (sets, rep
// range, RIR) carry over from the original slot — the replacement inherits
// the plan, not the other way around.
export function applySwaps(dayExercises, swaps) {
  return (dayExercises || []).map((ex) => {
    const to = swaps?.[ex.exercise_id]
    if (!to) return ex
    return {
      ...ex,
      exercise_id: to.exercise_id,
      exercise_name: to.exercise_name,
      // The replacement's own laterality rides the swap — a bilateral slot
      // swapped for a single-leg movement still logs per-limb.
      laterality: to.laterality ?? ex.laterality,
      swapped_from: ex.exercise_name,
    }
  })
}

// applyAdds appends session-added exercises after the plan, house defaults
// (2 sets, to failure). Skips ids already present so re-applying after the
// template itself absorbed the add stays idempotent.
export function applyAdds(planExercises, adds) {
  const out = [...(planExercises || [])]
  const seen = new Set(out.map((e) => e.exercise_id))
  for (const ad of adds || []) {
    if (seen.has(ad.exercise_id)) continue
    seen.add(ad.exercise_id)
    out.push({
      exercise_id: ad.exercise_id,
      exercise_name: ad.exercise_name,
      laterality: ad.laterality,
      target_sets: 2,
      added_in_session: true,
    })
  }
  return out
}

export function applyRemovals(planExercises, removals) {
  if (!removals?.length) return planExercises || []
  const gone = new Set(removals)
  return (planExercises || []).filter((e) => !gone.has(e.exercise_id))
}

// mergeExerciseOrder returns the (post-edit) plan plus a card for any
// exercise that has sets but no plan slot — e.g. sets logged before a swap,
// or a plan edit that removed an exercise mid-session. Logged work is never
// invisible.
export function mergeExerciseOrder(planExercises, sets) {
  const order = [...(planExercises || [])]
  const seen = new Set(order.map((e) => e.exercise_id))
  for (const s of sets || []) {
    if (!seen.has(s.exercise_id)) {
      seen.add(s.exercise_id)
      order.push({
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name,
        target_sets: 2,
        // The stub card must keep logging per-limb if the sets were per-limb
        // — the catalog row isn't at hand here, but the sets tell the truth.
        laterality: s.weight_left != null ? 'unilateral' : undefined,
      })
    }
  }
  return order
}

// diffPlan describes how the workout as performed drifted from the program
// as written — ONLY drift the lifter caused this session (swaps, adds,
// removals, extra recorded sets). Exercises resurrected from old sets by
// mergeExerciseOrder are history, not intent, and never count. Returns a
// list of human-readable changes, or null when the workout matches the plan.
export function diffPlan({ template, final, recordedCounts, adds = [], removals = [] }) {
  const changes = []
  const templateById = new Map((template || []).map((e) => [e.exercise_id, e]))
  const addIds = new Set((adds || []).map((a) => a.exercise_id))
  const removalIds = new Set(removals || [])

  for (const ex of final || []) {
    if (ex.swapped_from) {
      changes.push({ type: 'swap', label: `${ex.swapped_from} → ${ex.exercise_name}` })
    } else if (addIds.has(ex.exercise_id) && !templateById.has(ex.exercise_id)) {
      changes.push({ type: 'add', label: `Added ${ex.exercise_name}` })
    }
  }

  for (const ex of template || []) {
    if (removalIds.has(ex.exercise_id)) {
      changes.push({ type: 'remove', label: `Removed ${ex.exercise_name}` })
    }
  }

  for (const ex of final || []) {
    const target = templateById.get(ex.exercise_id)?.target_sets
    const done = recordedCounts?.get(ex.exercise_id) || 0
    if (target != null && done > target) {
      changes.push({
        type: 'sets',
        label: `${ex.exercise_name}: ${done} sets (plan says ${target})`,
      })
    }
  }

  return changes.length ? changes : null
}

// buildFuturePlan turns the workout as performed into the day template:
// positions follow the logger order, set targets grow to what was actually
// recorded (never shrink — an incomplete day is not a plan change), swapped
// slots keep their targets, added exercises get house defaults. Exercises
// that only exist because old sets resurrected them are excluded — the
// lifter approved the listed changes, nothing more.
export function buildFuturePlan({ template, final, recordedCounts, adds = [], swaps = {} }) {
  const templateIds = new Set((template || []).map((e) => e.exercise_id))
  const addIds = new Set((adds || []).map((a) => a.exercise_id))
  // An exercise swapped OUT this session must not ride back in as a
  // resurrection (it keeps its card when it has pre-swap sets) — the
  // approved diff says it was replaced, not duplicated.
  const swapSourceIds = new Set(Object.keys(swaps || {}).map(Number))
  return (final || [])
    .filter(
      (ex) =>
        !swapSourceIds.has(ex.exercise_id) &&
        (templateIds.has(ex.exercise_id) || ex.swapped_from || addIds.has(ex.exercise_id))
    )
    .map((ex, i) => ({
      exercise_id: ex.exercise_id,
      position: i + 1,
      target_sets: Math.max(ex.target_sets ?? 2, recordedCounts?.get(ex.exercise_id) || 0) || 2,
      target_rep_range_low: ex.target_rep_range_low ?? 8,
      target_rep_range_high: ex.target_rep_range_high ?? 12,
      target_rir: ex.target_rir ?? 0,
    }))
}
