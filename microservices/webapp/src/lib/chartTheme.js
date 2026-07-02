// Chart tokens (validated palette — see dataviz method; run the validator
// before adding categorical slots). Marks wear these; text wears text tokens.
// Both modes validated against the Iron Ledger card surfaces
// (#fffefb light / #201c19 dark): lightness band, chroma, CVD, contrast.
// series2 is contrast-warned on light — only use with direct labels.
import { useTheme } from './themeContext'

const light = {
  series1: '#2a78d6', // blue — primary series / sequential hue
  series2: '#1baf7a', // aqua — second series only (contrast-warned: needs labels)
  good: '#008300',
  grid: '#e7e2d9', // hairline, solid, recessive (warm paper neutral)
  axisText: '#6d6660', // ink-3
  ink: '#1c1917', // direct labels / headline figures
  surface: '#fffefb',
}

const dark = {
  series1: '#3987e5', // same hues, stepped for the dark surface — not a flip
  series2: '#199e70',
  good: '#0ca30c',
  grid: '#35302a',
  axisText: '#948c80',
  ink: '#ece7df',
  surface: '#201c19',
}

// Default export stays the light instance so non-reactive callers keep working.
export const chart = light

export const axisTick = { fontSize: 11, fill: chart.axisText }

// Theme-aware chart tokens — use inside components so charts restyle live.
export function useChartTheme() {
  const { isDark } = useTheme()
  const c = isDark ? dark : light
  return { chart: c, axisTick: { fontSize: 11, fill: c.axisText } }
}

export function formatShortDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
