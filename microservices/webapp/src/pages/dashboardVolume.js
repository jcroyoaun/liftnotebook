// Weeks are user-defined (mesocycles.current_week) — this picks the bucket
// for the lifter's CURRENT week. A fresh week has no bucket yet and
// correctly shows zeros; it never falls back to an older week's bars.
export function getWeekVolume(weeklyVolume, week) {
  if (!Array.isArray(weeklyVolume)) return []
  const bucket = weeklyVolume.find((w) => w.week === week)
  return Object.entries(bucket?.body_parts || {}).map(([body_part, total_sets]) => ({
    body_part,
    total_sets,
  }))
}
