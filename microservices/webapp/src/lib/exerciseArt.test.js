import test from 'node:test'
import assert from 'node:assert/strict'
import { EXERCISE_ART, hasExerciseArt } from './exerciseArt.js'

// The live catalog runs ids 1..62 (seed 1-59 + console-added 60-62). Every
// exercise must have art — when a new exercise is added via the console,
// this test is the reminder to draw it.
const CATALOG_IDS = Array.from({ length: 62 }, (_, i) => i + 1)

test('every catalog exercise has an illustration', () => {
  const missing = CATALOG_IDS.filter((id) => !hasExerciseArt(id))
  assert.deepEqual(missing, [], `missing art for exercise ids: ${missing}`)
})

test('scenes are non-trivial and every shape is well-formed', () => {
  for (const [id, scene] of Object.entries(EXERCISE_ART)) {
    assert.ok(scene.length >= 4, `scene ${id} suspiciously simple (${scene.length} shapes)`)
    for (const s of scene) {
      assert.ok(['l', 'c', 'r', 'p'].includes(s.t), `scene ${id}: unknown shape type ${s.t}`)
      assert.ok(['ink', 'frame', 'accent'].includes(s.c), `scene ${id}: unknown color slot ${s.c}`)
      const coords = [s.x1, s.y1, s.x2, s.y2, s.cx, s.cy, s.x, s.y].filter((v) => v !== undefined)
      for (const v of coords) {
        assert.ok(v >= -10 && v <= 110, `scene ${id}: coordinate ${v} far outside viewBox`)
      }
    }
  }
})

test('every scene includes the athlete (ink shapes)', () => {
  for (const [id, scene] of Object.entries(EXERCISE_ART)) {
    assert.ok(scene.some((s) => s.c === 'ink'), `scene ${id} has no figure`)
  }
})
