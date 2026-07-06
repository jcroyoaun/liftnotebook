import test from 'node:test'
import assert from 'node:assert/strict'
import { getWeekVolume } from './dashboardVolume.js'

const buckets = [
  { week: 1, body_parts: { chest: 6, back: 8 } },
  { week: 2, body_parts: { chest: 4 } },
]

test('getWeekVolume returns the requested user-week bucket', () => {
  assert.deepEqual(getWeekVolume(buckets, 2), [{ body_part: 'chest', total_sets: 4 }])
  assert.deepEqual(getWeekVolume(buckets, 1), [
    { body_part: 'chest', total_sets: 6 },
    { body_part: 'back', total_sets: 8 },
  ])
})

test('getWeekVolume shows zeros for a fresh week — never falls back to an older bucket', () => {
  assert.deepEqual(getWeekVolume(buckets, 3), [])
})

test('getWeekVolume handles empty or missing data', () => {
  assert.deepEqual(getWeekVolume([], 1), [])
  assert.deepEqual(getWeekVolume(undefined, 1), [])
})
