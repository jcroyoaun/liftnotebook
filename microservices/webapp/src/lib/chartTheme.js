// Chart tokens (validated palette — see dataviz method; run the validator
// before adding categorical slots). Marks wear these; text wears text tokens.
// Both modes validated against the Cobalt card surfaces
// (#ffffff light / #141a24 dark): lightness band, chroma, CVD, contrast —
// all checks pass with no warnings in either mode.
import { useTheme } from './themeContext'

const light = {
  series1: '#2563eb', // cobalt — primary series / sequential hue
  series1Soft: '#7aa2ec', // lighter cobalt step — part-to-whole companion of
  // series1 (secondary-muscle ½ credit). Validator: PASS band/chroma/CVD
  // (ΔE 35.9 protan); contrast WARN relieved by direct labels + table rows.
  series2: '#12996a', // green — second series only
  good: '#0f7a3d',
  grid: '#e4e8ee', // hairline, solid, recessive (cool slate neutral)
  axisText: '#5b6574', // ink-3
  ink: '#11151b', // direct labels / headline figures
  surface: '#ffffff',
}

const dark = {
  series1: '#4a80f2', // same hues, stepped for the dark surface — not a flip
  series1Soft: '#3a67bd', // validated dark step: all checks pass incl. contrast
  series2: '#199e70',
  good: '#3fbf74',
  grid: '#242e3d',
  axisText: '#8a94a8',
  ink: '#eef1f6',
  surface: '#141a24',
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
