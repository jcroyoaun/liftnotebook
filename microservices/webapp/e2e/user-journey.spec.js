// @ts-check
import { test, expect } from '@playwright/test'

const API = 'http://localhost:4001/v1'
const unique = Date.now()
const TEST_USER = {
  name: `E2E Tester ${unique}`,
  email: `e2e-${unique}@test.com`,
  password: 'testpassword123',
}

// Shared state across sequential tests
let token = ''
let userId = 0
let mesoId = 0
let dayIds = []

// --- Helper: direct API calls for verification ---
async function apiGet(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function apiPatch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

// Helper: log and record sets via API for an exercise in a session
async function logRecordedSets(sessionId, exerciseId, count, weight, reps, rir) {
  for (let i = 1; i <= count; i++) {
    const s = await apiPost('/sets', {
      workout_session_id: sessionId, exercise_id: exerciseId, set_number: i,
      weight, reps, rir,
    })
    await apiPatch(`/sets/${s.set.id}`, { weight, reps, rir, recorded: true })
  }
}

// Helper: login via UI and navigate
async function loginAndGo(page, path) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_USER.email)
  await page.locator('input[type="password"]').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL('/', { timeout: 5000 })
  token = await page.evaluate(() => localStorage.getItem('token'))
  if (path && path !== '/') {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
}

// ============================================================
test.describe.serial('Full User Journey', () => {

  // 1. REGISTER
  test('1. Register new user', async ({ page }) => {
    await page.goto('/register')
    await page.locator('input[type="text"]').fill(TEST_USER.name)
    await page.locator('input[type="email"]').fill(TEST_USER.email)
    await page.locator('input[type="password"]').fill(TEST_USER.password)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL('/', { timeout: 5000 })
    await expect(page.locator('text=Welcome')).toBeVisible()

    token = await page.evaluate(() => localStorage.getItem('token'))
    const user = JSON.parse(await page.evaluate(() => localStorage.getItem('user')))
    userId = user.id
    expect(token).toBeTruthy()
    expect(userId).toBeGreaterThan(0)
  })

  // 2. LOGIN
  test('2. Login with registered user', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_USER.email)
    await page.locator('input[type="password"]').fill(TEST_USER.password)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL('/', { timeout: 5000 })
    token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
  })

  // 3. CREATE 3-DAY MESOCYCLE (Push/Pull/Legs)
  test('3. Create a 3-day PPL mesocycle', async ({ page }) => {
    await loginAndGo(page, '/')

    await page.click('text=Create Mesocycle')
    await expect(page).toHaveURL('/mesocycle/new')

    // Enter name
    await page.locator('input[placeholder*="Hypertrophy"]').fill('E2E Test Meso')

    // Click PPL preset
    await page.click('button:text-is("PPL")')

    await page.locator('button[type="submit"]').click()

    // Should redirect to setup first day
    await page.waitForURL(/\/mesocycle\/\d+\/setup\/\d+/)
    mesoId = parseInt(page.url().match(/mesocycle\/(\d+)/)[1])
    expect(mesoId).toBeGreaterThan(0)

    // Fetch day IDs via API
    const data = await apiGet(`/mesocycles/${mesoId}`)
    dayIds = data.days.map(d => d.id)
    expect(dayIds).toHaveLength(3)
  })

  // 4. SETUP EXERCISES
  test('4a. Setup Push day exercises', async ({ page }) => {
    await loginAndGo(page, `/mesocycle/${mesoId}/setup/${dayIds[0]}`)

    // Add Flat Bench
    await page.locator('input[placeholder*="Search"]').fill('Flat Barbell')
    await page.click('button:has-text("Flat Barbell Bench Press")')

    // Add OHP
    await page.locator('input[placeholder*="Search"]').fill('Overhead')
    await page.click('button:has-text("Overhead Press")')

    // Volume preview should be visible
    await expect(page.locator('text=Volume')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=chest')).toBeVisible()

    await page.click('button:has-text("Save")')
    await page.waitForURL(/\/setup\//)
  })

  test('4b. Setup Pull day exercises', async ({ page }) => {
    await loginAndGo(page, `/mesocycle/${mesoId}/setup/${dayIds[1]}`)

    await page.locator('input[placeholder*="Search"]').fill('Pull-up')
    await page.click('button:has-text("Overhand Pull-up")')

    await page.locator('input[placeholder*="Search"]').fill('Machine Row')
    await page.click('button:has-text("Machine Row")')

    // Check weekly cumulative column
    await expect(page.locator('text=Week Total')).toBeVisible({ timeout: 3000 })

    await page.click('button:has-text("Save")')
    await page.waitForURL(/\/setup\//)
  })

  test('4c. Setup Legs day exercises', async ({ page }) => {
    await loginAndGo(page, `/mesocycle/${mesoId}/setup/${dayIds[2]}`)

    await page.locator('input[placeholder*="Search"]').fill('Back Squat')
    await page.click('button:has-text("Barbell Back Squat")')

    await page.locator('input[placeholder*="Search"]').fill('SSB Bulgarian')
    await page.click('button:has-text("SSB Bulgarian Split Squat")')

    // Volume should show quads and glutes
    await expect(page.locator('td:text("quadriceps")')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('td:text("glutes")')).toBeVisible({ timeout: 3000 })

    await page.click('button:has-text("Save & Finish")')
    await expect(page).toHaveURL('/')
  })

  // 5. DASHBOARD - verify mesocycle and projected volume
  test('5. Dashboard shows mesocycle with projected volume', async ({ page }) => {
    await loginAndGo(page, '/')

    await expect(page.locator('text=E2E Test Meso')).toBeVisible()
    await expect(page.locator('text=3 days/week')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day 1: Push' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day 2: Pull' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Day 3: Legs' })).toBeVisible()

    // Volume section
    await expect(page.locator('text=Weekly Volume')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Planned')).toBeVisible()
  })

  // 6. WEEK 1 - full training week
  test('6a. Week 1 Push workout', async ({ page }) => {
    await loginAndGo(page, '/')

    // Start Push workout
    const pushDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 1: Push' })
    await pushDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)

    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await expect(page.locator('text=Flat Barbell Bench Press')).toBeVisible()
    await expect(page.locator('text=Overhead Press')).toBeVisible()

    await page.getByRole('button', { name: 'Flat Barbell Bench Press' }).click()
    await expect(page.getByRole('heading', { name: 'Flat Barbell Bench Press' })).toBeVisible()
    await expect(page.locator('text=Primary Muscles')).toBeVisible()
    await expect(page.locator('text=Pectoralis Major')).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).click()

    // Log via API: Bench 3x8@100, OHP 2x10@60
    await logRecordedSets(sessionId, 11, 3, 100, 8, 3)
    await logRecordedSets(sessionId, 9, 2, 60, 10, 2)

    // Reload and verify recorded badge
    await page.reload()
    await expect(page.locator('text=Recorded').first()).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  test('6b. Week 1 Pull workout', async ({ page }) => {
    await loginAndGo(page, '/')
    const pullDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 2: Pull' })
    await pullDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await logRecordedSets(sessionId, 6, 3, 0, 10, 2)   // Pull-ups
    await logRecordedSets(sessionId, 8, 3, 80, 10, 2)   // Machine Row

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  test('6c. Week 1 Legs workout', async ({ page }) => {
    await loginAndGo(page, '/')
    const legsDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 3: Legs' })
    await legsDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await logRecordedSets(sessionId, 1, 3, 120, 6, 2)   // Back Squat
    await logRecordedSets(sessionId, 43, 3, 60, 10, 2)  // SSB Bulgarian

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  // 7. VERIFY VOLUME after week 1
  test('7. Verify actual volume math after week 1', async () => {
    const data = await apiGet(`/mesocycles/${mesoId}/volume`)
    const vol = {}
    ;(data.volume || []).forEach(bp => { vol[bp.body_part] = bp.total_sets })

    // Bench 3 sets primary chest = 3
    expect(vol['chest']).toBeGreaterThanOrEqual(3)
    // Pull-up 3 + Row 3, both primary back = 6
    expect(vol['back']).toBeGreaterThanOrEqual(6)
    // Squat 3 + SSB 3, both primary quads = 6
    expect(vol['quadriceps']).toBeGreaterThanOrEqual(6)
    // Squat primary glute (3) + SSB primary glute (3) = 6
    expect(vol['glutes']).toBeGreaterThanOrEqual(3)
  })

  // 8. WEEK 2 - progression
  test('8a. Week 2 Push workout (heavier)', async ({ page }) => {
    await loginAndGo(page, '/')
    const pushDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 1: Push' })
    await pushDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await logRecordedSets(sessionId, 11, 3, 105, 8, 2)  // Bench heavier
    await logRecordedSets(sessionId, 9, 2, 65, 10, 1)   // OHP heavier

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  test('8b. Week 2 Pull workout', async ({ page }) => {
    await loginAndGo(page, '/')
    const pullDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 2: Pull' })
    await pullDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await logRecordedSets(sessionId, 6, 3, 5, 10, 1)
    await logRecordedSets(sessionId, 8, 3, 85, 10, 1)

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  test('8c. Week 2 Legs workout', async ({ page }) => {
    await loginAndGo(page, '/')
    const legsDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 3: Legs' })
    await legsDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    await logRecordedSets(sessionId, 1, 3, 125, 6, 1)
    await logRecordedSets(sessionId, 43, 3, 65, 10, 1)

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  // 9. VERIFY PROGRESS (e1RM trends)
  test('9. Verify e1RM shows progression across 2 weeks', async () => {
    const bench = await apiGet('/progress/e1rm?exercise_id=11')
    expect(bench.progress.length).toBe(2)
    expect(bench.progress[1].avg_e1rm).toBeGreaterThan(bench.progress[0].avg_e1rm)

    const squat = await apiGet('/progress/e1rm?exercise_id=1')
    expect(squat.progress.length).toBe(2)
    expect(squat.progress[1].avg_e1rm).toBeGreaterThan(squat.progress[0].avg_e1rm)
  })

  // 10. VERIFY TOTAL VOLUME after 2 weeks
  test('10. Verify accumulated volume after 2 weeks', async () => {
    const data = await apiGet(`/mesocycles/${mesoId}/volume`)
    const vol = {}
    ;(data.volume || []).forEach(bp => { vol[bp.body_part] = bp.total_sets })

    // 2 weeks of bench: 3 sets x 2 = 6 sets on chest
    expect(vol['chest']).toBeGreaterThanOrEqual(6)
    // 2 weeks of pull+row: (3+3) x 2 = 12 sets on back
    expect(vol['back']).toBeGreaterThanOrEqual(12)
    // 2 weeks of squat+SSB: (3+3) x 2 = 12 sets on quads
    expect(vol['quadriceps']).toBeGreaterThanOrEqual(12)
  })

  // 11. UNRECORDED SETS should NOT count
  test('11. Unrecorded sets do not count toward volume', async ({ page }) => {
    // Capture volume before
    const before = await apiGet(`/mesocycles/${mesoId}/volume`)
    const chestBefore = (before.volume || []).find(bp => bp.body_part === 'chest')?.total_sets || 0

    await loginAndGo(page, '/')
    const pushDay = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Day 1: Push' })
    await pushDay.locator('button:has-text("Start Workout")').click()
    await page.waitForURL(/\/workout\/\d+/)
    const sessionId = parseInt(page.url().match(/workout\/(\d+)/)[1])

    // Log a set but do NOT record it
    await apiPost('/sets', {
      workout_session_id: sessionId, exercise_id: 11, set_number: 1,
      weight: 200, reps: 1, rir: 0,
    })

    const after = await apiGet(`/mesocycles/${mesoId}/volume`)
    const chestAfter = (after.volume || []).find(bp => bp.body_part === 'chest')?.total_sets || 0

    // Volume should be unchanged
    expect(chestAfter).toBe(chestBefore)

    await page.click('button:has-text("Finish")')
    await expect(page).toHaveURL('/')
  })

  // 12. PROGRESS PAGE shows user's exercises
  test('12. Progress page lists only exercises user has done', async ({ page }) => {
    await loginAndGo(page, '/progress')

    await expect(page.locator('button:has-text("Barbell Back Squat")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Flat Barbell Bench Press")')).toBeVisible()
    await expect(page.locator('button:has-text("Overhand Pull-up")')).toBeVisible()

    // Click bench to see chart
    await page.click('button:has-text("Flat Barbell Bench Press")')
    await expect(page.locator('text=Avg e1RM')).toBeVisible({ timeout: 5000 })
  })

  // 13. NAV LINKS
  test('13. Nav links work correctly', async ({ page }) => {
    await loginAndGo(page, '/progress')

    // "Workout" goes to /
    await page.click('nav >> text=Workout')
    await expect(page).toHaveURL('/')

    // "History" goes to /mesocycles
    await page.click('nav >> text=History')
    await expect(page).toHaveURL('/mesocycles')

    // Logo goes to /
    await page.click('nav >> text=LiftNotebook')
    await expect(page).toHaveURL('/')
  })

  // 14. DELETE MESOCYCLE
  test('14. Delete mesocycle', async ({ page }) => {
    await loginAndGo(page, '/mesocycles')
    await expect(page.locator('text=E2E Test Meso')).toBeVisible()

    page.on('dialog', dialog => dialog.accept())
    await page.click('button:has-text("Delete")')

    await expect(page.locator('text=E2E Test Meso')).not.toBeVisible({ timeout: 5000 })

    // Verify via API
    const data = await apiGet('/mesocycles')
    const found = (data.mesocycles || []).find(m => m.id === mesoId)
    expect(found).toBeUndefined()
  })

  // 15. SECOND MESOCYCLE lifecycle
  test('15. Create second mesocycle, verify, then delete', async ({ page }) => {
    await loginAndGo(page, '/')
    await expect(page.locator('text=Welcome')).toBeVisible()

    await page.click('text=Create Mesocycle')
    await page.locator('input[placeholder*="Hypertrophy"]').fill('E2E Meso 2')
    await page.click('button:text-is("2")')

    const labelInputs = page.locator('input[placeholder*="Day"]')
    await labelInputs.nth(0).fill('Upper')
    await labelInputs.nth(1).fill('Lower')

    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/mesocycle\/\d+\/setup\/\d+/)

    const newMesoId = parseInt(page.url().match(/mesocycle\/(\d+)/)[1])

    // Setup Upper
    await page.locator('input[placeholder*="Search"]').fill('Flat Barbell')
    await page.click('button:has-text("Flat Barbell Bench Press")')
    await page.click('button:has-text("Save")')
    await page.waitForURL(/\/setup\//)

    // Setup Lower
    await page.locator('input[placeholder*="Search"]').fill('Back Squat')
    await page.click('button:has-text("Barbell Back Squat")')
    await page.click('button:has-text("Save & Finish")')
    await expect(page).toHaveURL('/')

    await expect(page.locator('text=E2E Meso 2')).toBeVisible()

    // Delete via API
    const result = await apiDelete(`/mesocycles/${newMesoId}`)
    expect(result.message).toBe('mesocycle deleted')
  })
})
