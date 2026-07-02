// Plate math for loading a barbell. All weights in kg.

export const DEFAULT_BAR_KG = 20
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

// plateBreakdown returns the plates to load on EACH SIDE of the bar for a
// target total weight, greedily using the heaviest plates first.
// Returns { perSide: number[], loadable: number, exact: boolean }.
// `loadable` is the closest total weight (<= target) actually achievable.
export function plateBreakdown(targetKg, barKg = DEFAULT_BAR_KG, platesKg = DEFAULT_PLATES_KG) {
  const perSide = []

  if (!Number.isFinite(targetKg) || targetKg <= barKg) {
    return { perSide, loadable: barKg, exact: targetKg === barKg }
  }

  // Work in grams to dodge floating-point drift (2.5 + 1.25 issues).
  let remaining = Math.round(((targetKg - barKg) / 2) * 1000)
  const plates = [...platesKg].sort((a, b) => b - a).map((p) => Math.round(p * 1000))

  for (const plate of plates) {
    while (remaining >= plate) {
      perSide.push(plate / 1000)
      remaining -= plate
    }
  }

  const loadable = barKg + perSide.reduce((sum, p) => sum + p, 0) * 2
  return { perSide, loadable, exact: remaining === 0 }
}
