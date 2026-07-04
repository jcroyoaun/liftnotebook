import test from 'node:test'
import assert from 'node:assert/strict'
import { computeRegionLevels, computeRegionHeat } from './muscleHeat.js'

test('computeRegionLevels: primary wins over secondary in the same region', () => {
  const levels = computeRegionLevels([
    { muscle_name: 'Anterior Deltoid', target_type: 'secondary' },
    { muscle_name: 'Middle Deltoid', target_type: 'primary' },
    { muscle_name: 'Triceps Brachii', target_type: 'secondary' },
  ])
  assert.equal(levels.delts, 'primary')
  assert.equal(levels.triceps, 'secondary')
})

test('computeRegionHeat sums region members and normalizes to the busiest region', () => {
  const heat = computeRegionHeat([
    { muscle_name: 'Bicep Femoris', sets: 4 },
    { muscle_name: 'Semitendinosus', sets: 4 },
    { muscle_name: 'Biceps Brachii', sets: 4 },
    { muscle_name: 'Brachialis', sets: 1 },
  ])
  assert.equal(heat.hams.value, 8)
  assert.equal(heat.hams.intensity, 1)
  assert.equal(heat.biceps.value, 5)
  assert.equal(heat.biceps.intensity, 5 / 8)
})

test('computeRegionHeat ignores unknown muscles and zero volume', () => {
  assert.deepEqual(computeRegionHeat([{ muscle_name: 'Mystery Muscle', sets: 9 }]), {})
  assert.deepEqual(computeRegionHeat([{ muscle_name: 'Biceps Brachii', sets: 0 }]), {})
  assert.deepEqual(computeRegionHeat([]), {})
})
