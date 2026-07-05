import { test, expect } from '@playwright/test'

// Mid-workout exercise swap + edit-past-workout escape hatch + session notes.
// Catalog ids (dumps/seed.sql): 1 Barbell Back Squat, 8 Machine Row,
// 9 Overhead Press, 11 Flat Barbell Bench Press.

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

test.describe.serial('Swap, edit past workout, and notes', () => {
  test.beforeAll(async () => {
    const email = `swap-${Date.now()}@test.com`
    const reg = await api('/users/register', {
      method: 'POST',
      body: { name: 'Swap Tester', email, password: 'password123' },
    })
    token = reg.token
    user = reg.user

    const meso = await api('/mesocycles', {
      method: 'POST',
      body: { name: 'Swap Meso', days_per_week: 1, days: [{ day_number: 1, label: 'Push' }] },
    })
    mesoId = meso.mesocycle.id
    dayId = meso.days[0].id

    await api(`/training-days/${dayId}/exercises`, {
      method: 'PUT',
      body: {
        exercises: [
          { exercise_id: 11, position: 1 },
          { exercise_id: 9, position: 2 },
        ],
      },
    })

    const sess = await api('/sessions', {
      method: 'POST',
      body: { mesocycle_id: mesoId, training_day_id: dayId },
    })
    sessionId = sess.session.id
  })

  test('swap an exercise just for today and log a set under it', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)
    await expect(page.locator('text=Overhead Press')).toBeVisible()

    await page.click('button[aria-label="swap Overhead Press"]')
    const sheet = page.getByRole('dialog')
    await sheet.locator('input[placeholder*="replacement"]').fill('Machine Row')
    await sheet.locator('button:has-text("Machine Row")').click()
    await sheet.locator('button:has-text("Just this workout")').click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // The replacement card takes the slot; provenance is labelled.
    const card = page.locator('[class*="rounded-card"]').filter({ hasText: 'Machine Row' })
    await expect(card).toBeVisible()
    await expect(card.locator('text=usually Overhead Press')).toBeVisible()

    // Log a set under the swapped-in exercise. Planned set rows are
    // pre-created as drafts, so no "+ Add Set" needed — touch the first row.
    await card.locator('button[aria-label="increase weight"]').first().click()
    await card.locator('button:has-text("Done")').first().click()
    await expect(card.locator('text=Logged')).toBeVisible()

    await expect
      .poll(async () => {
        const data = await api(`/sessions/${sessionId}`)
        return (data.sets || []).some((s) => s.exercise_id === 8)
      }, { timeout: 10000 })
      .toBe(true)
  })

  test('swap for the rest of the block rewrites the day template', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)
    await expect(page.locator('text=Flat Barbell Bench Press')).toBeVisible()

    await page.click('button[aria-label="swap Flat Barbell Bench Press"]')
    const sheet = page.getByRole('dialog')
    await sheet.locator('input[placeholder*="replacement"]').fill('Barbell Back Squat')
    await sheet.locator('button:has-text("Barbell Back Squat")').click()
    await sheet.locator('button:has-text("For the rest of the block")').click()
    // The sheet closes only after the PUT resolves — wait for it, then poll
    // the API so a slow write can't race the assertion.
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(page.locator('text=Barbell Back Squat').first()).toBeVisible()

    // The day template now carries the squat in the bench's slot.
    await expect
      .poll(async () => {
        const meso = await api(`/mesocycles/${mesoId}`)
        const ids = meso.days[0].exercises.map((e) => e.exercise_id)
        return ids.includes(1) && !ids.includes(11)
      }, { timeout: 10000 })
      .toBe(true)
  })

  test('edit a past workout through the escape hatch', async ({ page }) => {
    const before = (await api(`/sessions/${sessionId}`)).sets.length

    await seedPage(page, `/sessions/${sessionId}`)
    await page.click('text=Edit workout')
    await expect(page).toHaveURL(`/workout/${sessionId}`)

    // Editing a finished workout is a distinct mode: no summary sheet, no
    // re-celebration — "Done editing" returns straight to the record.
    await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible()

    const card = page.locator('[class*="rounded-card"]').filter({ hasText: 'Barbell Back Squat' })
    await card.locator('button[aria-label="increase weight"]').first().click()
    await card.locator('button:has-text("Done")').first().click()
    await expect(card.locator('text=Logged')).toBeVisible()

    await page.click('button:has-text("Done editing")')
    await expect(page).toHaveURL(`/sessions/${sessionId}`)

    await expect
      .poll(async () => (await api(`/sessions/${sessionId}`)).sets.length, { timeout: 10000 })
      .toBe(before + 1)
  })

  test('add and edit session notes', async ({ page }) => {
    await seedPage(page, `/sessions/${sessionId}`)

    await page.click('text=Add notes')
    await page.getByRole('dialog').locator('textarea').fill('Machine was taken — swapped rows in.')
    await page.click('button:has-text("Save notes")')

    // The sheet closes only after the PATCH resolves; assert on the card, not
    // the (value-holding) textarea, then poll the API past any commit race.
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('text=Machine was taken — swapped rows in.')).toBeVisible()

    await expect
      .poll(async () => (await api(`/sessions/${sessionId}`)).session.notes, { timeout: 10000 })
      .toBe('Machine was taken — swapped rows in.')
  })

  test('rest alarm endpoints schedule and cancel', async () => {
    // API-level: browser push cannot run headlessly, but the scheduler and
    // its auth/validation must hold. Requires the local API to run with
    // VAPID keys configured.
    const scheduled = await api('/me/rest-alarm', { method: 'POST', body: { seconds: 60 } })
    expect(scheduled.message).toContain('scheduled')

    const cancelled = await api('/me/rest-alarm', { method: 'DELETE' })
    expect(cancelled.message).toContain('cancelled')
  })
})
