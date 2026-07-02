// Chart tokens (validated palette — see dataviz method; run the validator
// before adding categorical slots). Marks wear these; text wears text tokens.
export const chart = {
  series1: '#2a78d6', // blue — primary series / sequential hue
  series2: '#1baf7a', // aqua — second series only (contrast-warned: needs labels)
  good: '#008300',
  grid: '#e2e8f0', // hairline, solid, recessive
  axisText: '#64748b', // slate-500
  surface: '#ffffff',
}

export const axisTick = { fontSize: 11, fill: chart.axisText }

export function formatShortDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
