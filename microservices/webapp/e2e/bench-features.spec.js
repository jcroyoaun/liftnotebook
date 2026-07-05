import { test, expect } from '@playwright/test'

// 2026-07 training-quality batch: per-limb (unilateral) logging, dated
// per-exercise notes, the History tab, and per-set "last time" ghosts.
// Catalog ids (dumps/seed.sql): 1 Barbell Back Squat, 49 Single Leg Leg
// Press (laterality backfilled to 'unilateral' by migration 000009).

const API = 'http://localhost:4001/v1'

let token
let user
let mesoId
let dayId
let sessionId

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`)
  return res.json()
}

async function seedPage(page, path) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(
    (s) => {
      localStorage.setItem('token', s.token)
      localStorage.setItem('user', JSON.stringify(s.user))
    },
    { token, user },
  )
  await page.goto(path)
}

test.describe.serial('Unilateral sets, exercise notes, history', () => {
  test.beforeAll(async () => {
    const email = `bench-${Date.now()}@test.com`
    const reg = await api('/users/register', {
      method: 'POST',
      body: { name: 'Bench Features', email, password: 'password123' },
    })
    token = reg.token
    user = reg.user

    const meso = await api('/mesocycles', {
      method: 'POST',
      body: { name: 'Iso Meso', days_per_week: 1, days: [{ day_number: 1, label: 'Legs' }] },
    })
    mesoId = meso.mesocycle.id
    dayId = meso.days[0].id

    await api(`/training-days/${dayId}/exercises`, {
      method: 'PUT',
      body: {
        exercises: [
          { exercise_id: 49, position: 1 }, // Single Leg Leg Press — unilateral
          { exercise_id: 1, position: 2 },
        ],
      },
    })

    const sess = await api('/sessions', {
      method: 'POST',
      body: { mesocycle_id: mesoId, training_day_id: dayId },
    })
    sessionId = sess.session.id
  })

  test('unilateral exercise logs R/L weights as ONE set', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)

    const card = page.locator('[class*="rounded-card"]').filter({ hasText: 'Single Leg Leg Press' })
    await expect(card).toBeVisible()

    // Per-limb steppers on one row — a pair is one working set.
    const right = card.locator('input[type="number"]').first()
    await right.fill('60')
    const left = card.locator('input[type="number"]').nth(1)
    await left.fill('55')
    await card.locator('button:has-text("Done")').first().click()
    await expect(card.locator('text=Logged')).toBeVisible()

    // Counter treats the pair as ONE set toward the 2-set target.
    await expect(card.locator('text=1/2')).toBeVisible()

    // Server truth: one row, both limb weights, canonical weight = min(L, R).
    await expect
      .poll(async () => {
        const data = await api(`/sessions/${sessionId}`)
        const s = (data.sets || []).find((x) => x.exercise_id === 49 && x.recorded)
        return s ? `${s.weight_right}/${s.weight_left}/${s.weight}` : null
      }, { timeout: 10000 })
      .toBe('60/55/55')
  })

  test('exercise note saves and shows on the session record', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)

    await page.click('button[aria-label="note Single Leg Leg Press"]')
    const sheet = page.getByRole('dialog')
    await sheet.locator('textarea').fill('Right 60 / Left 55 — Panatta taken, used Lifefitness.')
    await sheet.locator('button:has-text("Save note")').click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect
      .poll(async () => {
        const data = await api(`/sessions/${sessionId}`)
        return (data.exercise_notes || []).some((n) => n.exercise_id === 49)
      }, { timeout: 10000 })
      .toBe(true)

    // Visible on the read-only record too.
    await seedPage(page, `/sessions/${sessionId}`)
    await expect(page.locator('text=Panatta taken')).toBeVisible()
  })

  test('History tab lists the workout and opens its record', async ({ page }) => {
    await seedPage(page, '/')
    await page.click('nav >> text=History')
    await expect(page).toHaveURL('/history')

    const row = page.locator('a').filter({ hasText: 'Legs' }).first()
    await expect(row).toBeVisible()
    await row.click()
    await expect(page).toHaveURL(`/sessions/${sessionId}`)
  })

  test('next session shows dated last-time line, per-set ghost, and past note', async ({ page }) => {
    const sess2 = await api('/sessions', {
      method: 'POST',
      body: { mesocycle_id: mesoId, training_day_id: dayId },
    })

    await seedPage(page, `/workout/${sess2.session.id}`)
    const card = page.locator('[class*="rounded-card"]').filter({ hasText: 'Single Leg Leg Press' })

    // Dated full-set recap + tap-to-fill ghost on the matching set row
    // (R first — the side he loads first).
    await expect(card.locator('text=Last time ·')).toBeVisible()
    await expect(card.locator('text=R60/L55 × 8')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Last: R 60 / L 55 kg × 8' })).toBeVisible()

    // Last session's note rides along, dated, right where it's needed.
    await expect(card.locator('text=Panatta taken')).toBeVisible()

    // Clean up: this throwaway session must not linger.
    await api(`/sessions/${sess2.session.id}`, { method: 'DELETE' })
  })

  test('done day card shows inline results; record edits per-exercise notes', async ({ page }) => {
    // The ✓ Done day card carries the receipts — per-set results and the
    // exercise note, zero extra taps.
    await seedPage(page, '/')
    const dayToggle = page.locator('button[aria-label="toggle Day 1: Legs"]')
    if ((await dayToggle.getAttribute('aria-expanded')) !== 'true') await dayToggle.click()
    const dayCard = page.locator('[class*="rounded-card"]').filter({ hasText: 'Day 1: Legs' })
    await expect(dayCard.locator('text=R60/L55×8')).toBeVisible()
    await expect(dayCard.locator('text=Panatta taken')).toBeVisible()

    // Per-exercise notes are editable straight from the workout record.
    await seedPage(page, `/sessions/${sessionId}`)
    await page.getByRole('button', { name: 'note Single Leg Leg Press' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.locator('textarea').fill('Right 60 / Left 55 — Panatta taken. Seat 4.')
    await sheet.locator('button:has-text("Save note")').click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('text=Seat 4.')).toBeVisible()

    await expect
      .poll(async () => {
        const data = await api(`/sessions/${sessionId}`)
        return (data.exercise_notes || []).find((n) => n.exercise_id === 49)?.note || ''
      }, { timeout: 10000 })
      .toContain('Seat 4.')
  })
})
