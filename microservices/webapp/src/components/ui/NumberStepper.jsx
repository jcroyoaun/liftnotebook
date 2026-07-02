// Mobile-first numeric input: +/- taps are the primary interaction (no
// keyboard needed mid-set), typing is secondary. Commits on every
// interaction rather than on blur so optimistic updates fire immediately.
export default function NumberStepper({ value, onChange, step = 1, min = 0, max = 9999, label, className = '' }) {
  const current = Number(value) || 0

  function clamp(n) {
    return Math.min(max, Math.max(min, n))
  }

  function handleType(e) {
    const raw = e.target.value
    if (raw === '') {
      onChange(min)
      return
    }
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) onChange(clamp(parsed))
  }

  return (
    <div className={className}>
      {label && <div className="mb-1 text-center text-xs text-ink-3">{label}</div>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`decrease ${label || 'value'}`}
          onClick={() => onChange(clamp(current - step))}
          className="h-11 w-11 shrink-0 rounded-field border border-line-2 bg-card text-xl font-medium text-ink-2 transition-all duration-100 active:scale-95 active:bg-sunken"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={handleType}
          className="h-11 w-full min-w-0 rounded-field border border-line-2 bg-raised text-center text-base font-semibold text-ink tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`increase ${label || 'value'}`}
          onClick={() => onChange(clamp(current + step))}
          className="h-11 w-11 shrink-0 rounded-field border border-line-2 bg-card text-xl font-medium text-ink-2 transition-all duration-100 active:scale-95 active:bg-sunken"
        >
          +
        </button>
      </div>
    </div>
  )
}
