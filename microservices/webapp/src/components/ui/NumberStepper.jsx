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
      {label && <div className="text-xs text-slate-500 mb-1 text-center">{label}</div>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`decrease ${label || 'value'}`}
          onClick={() => onChange(clamp(current - step))}
          className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 text-lg font-medium text-slate-600 active:bg-slate-100"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={handleType}
          className="h-10 w-full min-w-0 rounded-lg border border-slate-300 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`increase ${label || 'value'}`}
          onClick={() => onChange(clamp(current + step))}
          className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 text-lg font-medium text-slate-600 active:bg-slate-100"
        >
          +
        </button>
      </div>
    </div>
  )
}
