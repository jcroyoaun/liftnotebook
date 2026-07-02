import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kgToDisplay, displayToKg, getUnitPref } from './units.js'

test('kg passes through unchanged', () => {
  assert.equal(kgToDisplay(100, 'kg'), 100)
  assert.equal(displayToKg(100, 'kg'), 100)
})

test('lb display converts from canonical kg', () => {
  assert.equal(kgToDisplay(45.36, 'lb'), 100)
  assert.equal(kgToDisplay(20, 'lb'), 44.1)
})

test('lb input converts to canonical kg', () => {
  assert.equal(displayToKg(100, 'lb'), 45.36)
  assert.equal(displayToKg(45, 'lb'), 20.41)
})

test('lb round-trips through kg storage without drift', () => {
  for (const lbs of [5, 45, 100, 225, 315, 402.5]) {
    assert.equal(kgToDisplay(displayToKg(lbs, 'lb'), 'lb'), lbs)
  }
})

test('non-numeric input degrades to zero', () => {
  assert.equal(displayToKg('', 'lb'), 0)
  assert.equal(kgToDisplay(undefined, 'lb'), 0)
})

test('unit pref falls back to kg without storage', () => {
  // node has no localStorage — the helper must not throw
  assert.equal(getUnitPref(11), 'kg')
})
