// Tiny shared formatting helpers. Adopt incrementally — no page is required
// to route every string through here yet.

// plural(1, 'set') -> '1 set'; plural(3, 'set') -> '3 sets';
// plural(2, 'day', 'days') -> '2 days' (explicit plural for irregulars).
export function plural(n, singular, pluralWord) {
  return `${n} ${n === 1 ? singular : pluralWord ?? `${singular}s`}`
}

// Whole numbers with locale separators: fmtInt(12345) -> '12,345'.
export function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString()
}

// Weights are canonical kg. Trims trailing zeros: 60.00 -> '60 kg',
// 62.50 -> '62.5 kg'.
export function fmtKg(n) {
  const num = Number(n) || 0
  return `${parseFloat(num.toFixed(2))} kg`
}
