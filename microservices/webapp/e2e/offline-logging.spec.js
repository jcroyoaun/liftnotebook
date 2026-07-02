import { test, expect } from '@playwright/test'

// Offline gym scenario: sets logged with no connectivity must appear
// instantly (optimistic cache), queue while offline, and sync to the API
// when the connection returns — without duplicating (client_id idempotency).

const API = 'http://localhost:4001/v1'

let token
let user
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

test.describe.serial('Offline set logging', () => {
  test.beforeAll(async () => {
    const email = `offline-${Date.now()}@test.com`
    const reg = await api('/users/register', {
      method: 'POST',
      body: { name: 'Offline Tester', email, password: 'password123' },
    })
    token = reg.token
    user = reg.user

    const meso = await api('/mesocycles', {
      method: 'POST',
      body: { name: 'Offline Meso', days_per_week: 1, days: [{ day_number: 1, label: 'Full Body' }] },
    })
    const dayId = meso.days[0].id

    await api(`/training-days/${dayId}/exercises`, {
      method: 'PUT',
      body: { exercises: [{ exercise_id: 1, position: 1 }] },
    })

    const sess = await api('/sessions', {
      method: 'POST',
      body: { mesocycle_id: meso.mesocycle.id, training_day_id: dayId },
    })
    sessionId = sess.session.id
  })

  test('sets logged offline sync on reconnect', async ({ page, context }) => {
    // Seed the session directly; visiting any page first gives us an origin.
    await page.goto('/login')
    // Settle Vite's dev-server dependency-optimizer reload before evaluate.
    await page.waitForLoadState('networkidle')
    await page.evaluate(
      (s) => {
        localStorage.setItem('token', s.token)
        localStorage.setItem('user', JSON.stringify(s.user))
      },
      { token, user },
    )

    await page.goto(`/workout/${sessionId}`)
    await expect(page.locator('text=Barbell Back Squat')).toBeVisible()

    // Kill the network.
    await context.setOffline(true)

    // Log a set entirely offline.
    await page.click('button:has-text("Add Set")')
    await page.locator('button[aria-label="increase kg"]').click() // 0 -> 2.5
    await page.click('button:has-text("Done")')

    // Optimistic UI: the set shows as logged immediately, and once the
    // debounced write fires it queues as a pending mutation.
    await expect(page.locator('text=Logged')).toBeVisible()
    await expect(page.getByTestId('sync-status')).toContainText('1 pending')

    // Nothing reached the server yet.
    const before = await api(`/sessions/${sessionId}`)
    expect((before.sets || []).length).toBe(0)

    // Reconnect: the paused mutation replays automatically.
    await context.setOffline(false)
    await expect(page.getByTestId('sync-status')).toBeHidden({ timeout: 15000 })

    const after = await api(`/sessions/${sessionId}`)
    expect(after.sets.length).toBe(1)
    expect(after.sets[0].recorded).toBe(true)
    expect(Number(after.sets[0].weight)).toBe(2.5)
    expect(after.sets[0].reps).toBe(8)
  })

  test('editing a synced set while offline converges to the final value', async ({ page, context }) => {
    await page.goto('/login')
    // Settle Vite's dev-server dependency-optimizer reload before evaluate.
    await page.waitForLoadState('networkidle')
    await page.evaluate(
      (s) => {
        localStorage.setItem('token', s.token)
        localStorage.setItem('user', JSON.stringify(s.user))
      },
      { token, user },
    )
    await page.goto(`/workout/${sessionId}`)
    await expect(page.locator('text=Logged')).toBeVisible()

    await context.setOffline(true)

    // Bump the weight twice offline: 2.5 -> 7.5.
    await page.locator('button[aria-label="increase kg"]').click()
    await page.locator('button[aria-label="increase kg"]').click()
    await expect(page.getByTestId('sync-status')).toContainText('pending', { timeout: 5000 })

    await context.setOffline(false)
    await expect(page.getByTestId('sync-status')).toBeHidden({ timeout: 15000 })

    const after = await api(`/sessions/${sessionId}`)
    // Still exactly one set — the offline edit upserted, not duplicated.
    expect(after.sets.length).toBe(1)
    expect(Number(after.sets[0].weight)).toBe(7.5)
  })
})
