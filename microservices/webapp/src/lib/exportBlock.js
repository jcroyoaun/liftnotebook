// Turns a block export (GET /v1/mesocycles/:id/export) into downloadable
// files. JSON is the canonical takeout; the CSVs are spreadsheet-friendly
// flattenings: the program plan and the full set log.

export function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n'
}

// One row per programmed exercise slot.
export function toProgramCSV(exp) {
  const rows = [['block', 'day_number', 'day_label', 'position', 'exercise', 'target_sets', 'target_rep_low', 'target_rep_high', 'target_rir']]
  for (const day of exp.days || []) {
    for (const ex of day.exercises || []) {
      rows.push([
        exp.mesocycle?.name, day.day_number, day.label, ex.position, ex.exercise_name,
        ex.target_sets, ex.target_rep_range_low, ex.target_rep_range_high, ex.target_rir,
      ])
    }
  }
  return csv(rows)
}

// One row per logged set, oldest session first.
export function toHistoryCSV(exp) {
  const rows = [['date', 'day_label', 'exercise', 'set_number', 'weight_kg', 'reps', 'rir', 'recorded']]
  const sessions = [...(exp.sessions || [])].sort(
    (a, b) => new Date(a.performed_at) - new Date(b.performed_at)
  )
  for (const sess of sessions) {
    const date = (sess.performed_at || '').slice(0, 10)
    for (const set of sess.sets || []) {
      rows.push([
        date, sess.day_label, set.exercise_name, set.set_number,
        set.weight, set.reps, set.rir ?? '', set.recorded,
      ])
    }
  }
  return csv(rows)
}

export function blockSlug(name) {
  return (name || 'block').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block'
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
