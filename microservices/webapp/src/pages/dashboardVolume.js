export function getLatestWeeklyVolume(weeklyVolume) {
  if (!Array.isArray(weeklyVolume) || weeklyVolume.length === 0) {
    return [];
  }

  const latestWeek = weeklyVolume.reduce((latest, current) => {
    if (!latest) {
      return current;
    }

    return new Date(current.week_start) > new Date(latest.week_start) ? current : latest;
  }, null);

  return Object.entries(latestWeek.body_parts || {}).map(([body_part, total_sets]) => ({
    body_part,
    total_sets,
  }));
}
