import test from 'node:test';
import assert from 'node:assert/strict';

import { getLatestWeeklyVolume } from './dashboardVolume.js';

test('getLatestWeeklyVolume returns the newest weekly totals', () => {
  const volume = getLatestWeeklyVolume([
    {
      week_start: '2026-03-02T00:00:00Z',
      body_parts: { chest: 6, back: 12 },
    },
    {
      week_start: '2026-03-09T00:00:00Z',
      body_parts: { chest: 3, back: 6 },
    },
  ]);

  assert.deepEqual(volume, [
    { body_part: 'chest', total_sets: 3 },
    { body_part: 'back', total_sets: 6 },
  ]);
});

test('getLatestWeeklyVolume handles empty data', () => {
  assert.deepEqual(getLatestWeeklyVolume([]), []);
});
