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
    await sheet.locator('button:has-text("Swap in")').click()
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

  test('a swap becomes the plan through the save-time scope prompt', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)
    await expect(page.locator('text=Flat Barbell Bench Press')).toBeVisible()

    await page.click('button[aria-label="swap Flat Barbell Bench Press"]')
    const sheet = page.getByRole('dialog')
    await sheet.locator('input[placeholder*="replacement"]').fill('Barbell Back Squat')
    await sheet.locator('button:has-text("Barbell Back Squat")').click()
    await sheet.locator('button:has-text("Swap in")').click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('text=Barbell Back Squat').first()).toBeVisible()

    // A fresh tab on a session with recorded work is edit mode by default
    // (no hijacking old workouts as active). Save → the one-time scope
    // prompt lists the drift from the plan.
    await page.getByRole('button', { name: 'Done editing' }).click()
    await expect(page.locator('text=You went off-plan')).toBeVisible()
    await expect(page.locator('text=Flat Barbell Bench Press → Barbell Back Squat')).toBeVisible()
    await page.click('button:has-text("All future workouts")')

    // The day template now carries the squat in the bench's slot.
    await expect
      .poll(async () => {
        const meso = await api(`/mesocycles/${mesoId}`)
        const ids = meso.days[0].exercises.map((e) => e.exercise_id)
        return ids.includes(1) && !ids.includes(11)
      }, { timeout: 10000 })
      .toBe(true)
  })

  test('a finished workout opens straight in the logger for editing', async ({ page }) => {
    const before = (await api(`/sessions/${sessionId}`)).sets.length

    // One view per workout: legacy /sessions links land in the logger, edit
    // mode — no read-only record page, no escape hatch to hunt for.
    await seedPage(page, `/sessions/${sessionId}`)
    await expect(page).toHaveURL(`/workout/${sessionId}`)

    // Edit mode: no summary sheet, no re-celebration, timers off.
    await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible()

    const card = page.locator('[class*="rounded-card"]').filter({ hasText: 'Barbell Back Squat' })
    await card.locator('button[aria-label="increase weight"]').first().click()
    await card.locator('button:has-text("Done")').first().click()
    await expect(card.locator('text=Logged')).toBeVisible()

    await page.click('button:has-text("Done editing")')
    await expect(page).toHaveURL('/')

    await expect
      .poll(async () => (await api(`/sessions/${sessionId}`)).sets.length, { timeout: 10000 })
      .toBe(before + 1)
  })

  test('add and remove exercises in the logger; "This workout only" leaves the plan alone', async ({ page }) => {
    await seedPage(page, `/workout/${sessionId}`)
    await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible()

    // Add an exercise beyond the plan (Bench left the template in the swap
    // test, so it's available to add back as a one-off).
    await page.click('button:has-text("+ Add exercise")')
    let sheet = page.getByRole('dialog')
    await sheet.locator('input[placeholder*="exercise"]').fill('Flat Barbell Bench Press')
    await sheet.locator('button:has-text("Flat Barbell Bench Press")').click()
    await sheet.locator('button:has-text("Add to workout")').click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.locator('text=Added this session')).toBeVisible()

    // Remove Machine Row — it has a recorded set, so the confirm sheet
    // warns before deleting it from the record.
    await page.click('button[aria-label="swap Machine Row (Chest Supported)"]')
    await page.getByRole('dialog').locator('button:has-text("Remove from this workout")').click()
    await page.getByRole('dialog').locator('button:has-text("Remove exercise")').click()
    await expect(page.locator('button[aria-label="swap Machine Row (Chest Supported)"]')).toBeHidden()

    // Save as a one-off: the prompt lists the drift, the template survives.
    await page.getByRole('button', { name: 'Done editing' }).click()
    await expect(page.locator('text=You went off-plan')).toBeVisible()
    await expect(page.locator('text=Added Flat Barbell Bench Press')).toBeVisible()
    await page.click('button:has-text("This workout only")')
    await expect(page).toHaveURL('/')

    // Machine Row's set is gone from the record; the day template is intact.
    await expect
      .poll(async () => (await api(`/sessions/${sessionId}`)).sets.every((s) => s.exercise_id !== 8), { timeout: 10000 })
      .toBe(true)
    const meso = await api(`/mesocycles/${mesoId}`)
    const ids = meso.days[0].exercises.map((e) => e.exercise_id).sort()
    expect(ids).toEqual([1, 9])
  })

  test('add and edit session notes', async ({ page }) => {
    await seedPage(page, `/sessions/${sessionId}`)

    // exact:true — per-exercise 'Add note' buttons live on the same page, and
    // the loose text engine can even match a card whose text runs
    // 'Add note'+'Set 1' together.
    await page.getByRole('button', { name: 'Add notes', exact: true }).click()
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
