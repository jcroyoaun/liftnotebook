import test from 'node:test';
import assert from 'node:assert/strict';

import { plateBreakdown } from './plates.js';

test('exact load with standard plates', () => {
  const { perSide, loadable, exact } = plateBreakdown(100);
  assert.deepEqual(perSide, [25, 15]);
  assert.equal(loadable, 100);
  assert.equal(exact, true);
});

test('small increments use fractional plates', () => {
  const { perSide, exact } = plateBreakdown(102.5);
  assert.deepEqual(perSide, [25, 15, 1.25]);
  assert.equal(exact, true);
});

test('bar-only and below-bar targets', () => {
  assert.deepEqual(plateBreakdown(20).perSide, []);
  assert.equal(plateBreakdown(20).exact, true);
  assert.equal(plateBreakdown(15).exact, false);
  assert.equal(plateBreakdown(15).loadable, 20);
});

test('unloadable remainder reports closest achievable weight', () => {
  const { loadable, exact } = plateBreakdown(101); // 40.5 per side unreachable, 40 is
  assert.equal(exact, false);
  assert.equal(loadable, 100);
});

test('floating point chains stay exact', () => {
  const { perSide, exact } = plateBreakdown(27.5); // 3.75 per side = 2.5 + 1.25
  assert.deepEqual(perSide, [2.5, 1.25]);
  assert.equal(exact, true);
});

test('custom bar and plate set', () => {
  const { perSide, exact } = plateBreakdown(40, 10, [5, 2.5]);
  assert.deepEqual(perSide, [5, 5, 5]);
  assert.equal(exact, true);
});
