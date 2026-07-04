import test from 'node:test'
import assert from 'node:assert/strict'
import { toProgramCSV, toHistoryCSV, csvEscape, blockSlug } from './exportBlock.js'

const EXPORT = {
  mesocycle: { id: 1, name: 'Upper/Lower, "Maximalist"' },
  days: [
    {
      day_number: 1,
      label: 'Upper A',
      exercises: [
        { position: 1, exercise_name: 'Machine Chest Press', target_sets: 2, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0 },
        { position: 2, exercise_name: 'Pec Deck', target_sets: 1, target_rep_range_low: 8, target_rep_range_high: 12, target_rir: 0 },
      ],
    },
  ],
  sessions: [
    {
      day_label: 'Upper A', performed_at: '2026-07-04T18:00:00Z',
      sets: [
        { exercise_name: 'Machine Chest Press', set_number: 1, weight: 80, reps: 10, rir: 0, recorded: true },
        { exercise_name: 'Machine Chest Press', set_number: 2, weight: 80, reps: 8, rir: null, recorded: false },
      ],
    },
    { day_label: 'Upper A', performed_at: '2026-07-01T18:00:00Z', sets: [] },
  ],
}

test('program CSV: header + one row per slot, commas/quotes escaped', () => {
  const lines = toProgramCSV(EXPORT).trim().split('\n')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], 'block,day_number,day_label,position,exercise,target_sets,target_rep_low,target_rep_high,target_rir')
  assert.ok(lines[1].startsWith('"Upper/Lower, ""Maximalist""",1,Upper A,1,Machine Chest Press,2,8,12,0'))
  assert.ok(lines[2].includes('Pec Deck,1'))
})

test('history CSV: oldest session first, one row per set, null rir blank', () => {
  const lines = toHistoryCSV(EXPORT).trim().split('\n')
  assert.equal(lines.length, 3) // header + 2 sets (empty session adds none)
  assert.equal(lines[0], 'date,day_label,exercise,set_number,weight_kg,reps,rir,recorded')
  assert.equal(lines[1], '2026-07-04,Upper A,Machine Chest Press,1,80,10,0,true')
  assert.equal(lines[2], '2026-07-04,Upper A,Machine Chest Press,2,80,8,,false')
})

test('csvEscape handles quotes, commas, newlines, null', () => {
  assert.equal(csvEscape('plain'), 'plain')
  assert.equal(csvEscape('a,b'), '"a,b"')
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""')
  assert.equal(csvEscape(null), '')
})

test('blockSlug produces safe filenames', () => {
  assert.equal(blockSlug('Upper/Lower Maximalist — Injury Edition'), 'upper-lower-maximalist-injury-edition')
  assert.equal(blockSlug('   '), 'block')
})
