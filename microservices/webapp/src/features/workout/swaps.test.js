import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applySwaps, applyAdds, applyRemovals, mergeExerciseOrder, diffPlan, buildFuturePlan,
} from './swaps.js'

const plan = [
  { exercise_id: 11, exercise_name: 'Bench Press', position: 1, target_sets: 2, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0 },
  { exercise_id: 9, exercise_name: 'Overhead Press', position: 2, target_sets: 3, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0 },
]

test('applySwaps replaces exercise identity but keeps the slot targets', () => {
  const swaps = { 9: { exercise_id: 21, exercise_name: 'Machine Shoulder Press' } }
  const out = applySwaps(plan, swaps)

  assert.equal(out[0].exercise_id, 11)
  assert.equal(out[1].exercise_id, 21)
  assert.equal(out[1].exercise_name, 'Machine Shoulder Press')
  assert.equal(out[1].target_sets, 3)
  assert.equal(out[1].swapped_from, 'Overhead Press')
})

test('applySwaps is a no-op for empty or stale swap tables', () => {
  assert.deepEqual(applySwaps(plan, {}), plan)
  assert.deepEqual(applySwaps(plan, { 999: { exercise_id: 1, exercise_name: 'X' } }), plan)
  assert.deepEqual(applySwaps([], { 9: { exercise_id: 21, exercise_name: 'Y' } }), [])
})

test('mergeExerciseOrder keeps plan order and appends off-plan set exercises', () => {
  const sets = [
    { exercise_id: 11, exercise_name: 'Bench Press' },
    { exercise_id: 40, exercise_name: 'Cable Fly' },
    { exercise_id: 40, exercise_name: 'Cable Fly' },
  ]
  const out = mergeExerciseOrder(plan, sets)

  assert.equal(out.length, 3)
  assert.equal(out[0].exercise_id, 11)
  assert.equal(out[1].exercise_id, 9)
  assert.equal(out[2].exercise_id, 40)
  assert.equal(out[2].target_sets, 2)
})

test('mergeExerciseOrder derives cards purely from sets when there is no plan', () => {
  const sets = [{ exercise_id: 5, exercise_name: 'Deadlift' }]
  const out = mergeExerciseOrder([], sets)

  assert.equal(out.length, 1)
  assert.equal(out[0].exercise_name, 'Deadlift')
})

test('swapped-out exercise with logged sets stays visible after the swap', () => {
  const swaps = { 11: { exercise_id: 50, exercise_name: 'Dumbbell Press' } }
  const sets = [{ exercise_id: 11, exercise_name: 'Bench Press' }]
  const out = mergeExerciseOrder(applySwaps(plan, swaps), sets)

  assert.deepEqual(out.map((e) => e.exercise_id), [50, 9, 11])
  assert.equal(out[0].swapped_from, 'Bench Press')
})

test('applyAdds appends with house defaults and skips ids the plan already has', () => {
  const adds = [
    { exercise_id: 30, exercise_name: 'Cable Crunch', laterality: 'bilateral' },
    { exercise_id: 11, exercise_name: 'Bench Press' }, // absorbed into the template already
  ]
  const out = applyAdds(plan, adds)

  assert.deepEqual(out.map((e) => e.exercise_id), [11, 9, 30])
  assert.equal(out[2].target_sets, 2)
  assert.equal(out[2].added_in_session, true)
})

test('applyRemovals drops removed ids and is a no-op when empty', () => {
  assert.deepEqual(applyRemovals(plan, [9]).map((e) => e.exercise_id), [11])
  assert.equal(applyRemovals(plan, []), plan)
})

test('diffPlan reports swaps, adds, removals and extra recorded sets — nothing else', () => {
  const adds = [{ exercise_id: 30, exercise_name: 'Cable Crunch' }]
  const final = [
    { exercise_id: 21, exercise_name: 'Machine Shoulder Press', target_sets: 3, swapped_from: 'Overhead Press' },
    { exercise_id: 30, exercise_name: 'Cable Crunch', target_sets: 2, added_in_session: true },
    // resurrected from old sets — history, not intent
    { exercise_id: 40, exercise_name: 'Cable Fly', target_sets: 2 },
  ]
  const recordedCounts = new Map([[21, 3], [30, 2]])
  const changes = diffPlan({ template: plan, final, recordedCounts, adds, removals: [11] })

  assert.deepEqual(changes.map((c) => c.type), ['swap', 'add', 'remove'])
  assert.equal(changes[0].label, 'Overhead Press → Machine Shoulder Press')
  assert.equal(changes[1].label, 'Added Cable Crunch')
  assert.equal(changes[2].label, 'Removed Bench Press')
})

test('diffPlan flags recorded sets beyond the slot target and is null on a clean day', () => {
  const recordedCounts = new Map([[11, 3], [9, 2]])
  const changes = diffPlan({ template: plan, final: plan, recordedCounts })
  assert.equal(changes.length, 1)
  assert.equal(changes[0].label, 'Bench Press: 3 sets (plan says 2)')

  // At or under target — an incomplete day is not a plan change.
  assert.equal(diffPlan({ template: plan, final: plan, recordedCounts: new Map([[11, 2], [9, 1]]) }), null)
})

test('buildFuturePlan follows logger order, grows targets to recorded work, excludes resurrections', () => {
  const adds = [{ exercise_id: 30, exercise_name: 'Cable Crunch' }]
  const final = [
    { exercise_id: 21, exercise_name: 'Machine Shoulder Press', target_sets: 3, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0, swapped_from: 'Overhead Press' },
    { exercise_id: 11, exercise_name: 'Bench Press', target_sets: 2, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0 },
    { exercise_id: 30, exercise_name: 'Cable Crunch', target_sets: 2, added_in_session: true },
    { exercise_id: 40, exercise_name: 'Cable Fly', target_sets: 2 }, // resurrected — excluded
  ]
  const recordedCounts = new Map([[21, 3], [11, 3], [30, 1]])
  const out = buildFuturePlan({ template: plan, final, recordedCounts, adds })

  assert.deepEqual(out.map((e) => [e.exercise_id, e.position, e.target_sets]), [
    [21, 1, 3], // swapped slot keeps its inherited target
    [11, 2, 3], // grew to the recorded work
    [30, 3, 2], // added: house default beats 1 recorded set — never shrink below 2
  ])
  assert.equal(out[2].target_rep_range_low, 8)
  assert.equal(out[2].target_rir, 0)
})

test('buildFuturePlan never re-admits a swapped-out original resurrected by its pre-swap sets', () => {
  const swaps = { 9: { exercise_id: 21, exercise_name: 'Machine Shoulder Press' } }
  const final = [
    { exercise_id: 11, exercise_name: 'Bench Press', target_sets: 2 },
    { exercise_id: 21, exercise_name: 'Machine Shoulder Press', target_sets: 3, swapped_from: 'Overhead Press' },
    // OHP logged a set before the swap — it keeps a card, not a plan slot.
    { exercise_id: 9, exercise_name: 'Overhead Press', target_sets: 2 },
  ]
  const out = buildFuturePlan({ template: plan, final, recordedCounts: new Map([[9, 1]]), swaps })

  assert.deepEqual(out.map((e) => e.exercise_id), [11, 21])
})
