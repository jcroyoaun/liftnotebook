import test from 'node:test'
import assert from 'node:assert/strict'
import { applySwaps, mergeExerciseOrder } from './swaps.js'

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
