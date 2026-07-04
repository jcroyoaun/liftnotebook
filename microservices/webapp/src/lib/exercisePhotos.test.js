import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { exercisePhotoUrls } from './exercisePhotos.js'

const CATALOG_IDS = Array.from({ length: 62 }, (_, i) => i + 1)

test('every advertised photo pair exists on disk', () => {
  for (const id of CATALOG_IDS) {
    const urls = exercisePhotoUrls(id)
    if (!urls) continue
    for (const url of urls) {
      const file = fileURLToPath(new URL(`../../public${url}`, import.meta.url))
      assert.ok(existsSync(file), `missing photo file for exercise ${id}: ${url}`)
    }
  }
})

test('photo coverage matches the reviewed mapping (50 exercises)', () => {
  const covered = CATALOG_IDS.filter((id) => exercisePhotoUrls(id) !== null)
  assert.equal(covered.length, 50)
  // Deliberately line-art-only: exotics + rejected mappings.
  for (const id of [22, 27, 38, 44, 45, 47, 49, 50, 51, 53, 54, 58]) {
    assert.equal(exercisePhotoUrls(id), null, `exercise ${id} should not advertise a photo`)
  }
})

test('unknown ids return null', () => {
  assert.equal(exercisePhotoUrls(999), null)
})
