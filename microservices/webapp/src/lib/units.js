// Weight units. Storage is ALWAYS kg (canonical) — lb exists only at the
// input edge, for gyms with mixed US/metric equipment. Progression math,
// history, and charts never see lb.
export const KG_PER_LB = 0.45359237

export function kgToDisplay(kg, unit) {
  const n = Number(kg) || 0
  if (unit === 'lb') return Math.round((n / KG_PER_LB) * 10) / 10
  return n
}

export function displayToKg(value, unit) {
  const n = Number(value) || 0
  if (unit === 'lb') return Math.round(n * KG_PER_LB * 100) / 100
  return n
}

const PREFS_KEY = 'unitPrefs'

// Per-exercise input-unit memory: "this cable station is in lb" tends to be
// sticky per exercise, so remember the last unit used for each.
export function getUnitPref(exerciseId) {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')[exerciseId] || 'kg'
  } catch {
    return 'kg'
  }
}

export function setUnitPref(exerciseId, unit) {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    prefs[exerciseId] = unit
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable — the toggle still works for this row.
  }
}
