// Session-scoped exercise swaps. A swap is device-local by design: it lives
// in localStorage keyed by session and evaporates when the workout closes.
// "Swap for the rest of the block" additionally rewrites the day template
// server-side; the local entry then simply stops matching anything.

const storageKey = (sessionId) => `sessionSwaps:${sessionId}`

export function loadSwaps(sessionId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(sessionId))) || {}
  } catch {
    return {}
  }
}

export function saveSwap(sessionId, fromExerciseId, to) {
  const swaps = loadSwaps(sessionId)
  swaps[fromExerciseId] = to
  localStorage.setItem(storageKey(sessionId), JSON.stringify(swaps))
  return swaps
}

export function clearSwaps(sessionId) {
  localStorage.removeItem(storageKey(sessionId))
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

// mergeExerciseOrder returns the (post-swap) plan plus a card for any
// exercise that has sets but no plan slot — e.g. sets logged before a swap,
// or a plan edit that removed an exercise mid-session. Logged work is never
// invisible.
export function mergeExerciseOrder(planExercises, sets) {
  const order = [...(planExercises || [])]
  const seen = new Set(order.map((e) => e.exercise_id))
  for (const s of sets || []) {
    if (!seen.has(s.exercise_id)) {
      seen.add(s.exercise_id)
      order.push({ exercise_id: s.exercise_id, exercise_name: s.exercise_name, target_sets: 2 })
    }
  }
  return order
}
