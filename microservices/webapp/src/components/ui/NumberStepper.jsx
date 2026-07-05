import { useRef, useState } from 'react'

// Mobile-first numeric input: +/- taps are the primary interaction (no
// keyboard needed mid-set), typing is secondary. Valid numbers commit on
// every keystroke so optimistic updates fire immediately, but the field
// itself holds a local draft: clearing it must NOT snap back to min, or
// "1" can never be deleted before typing "6" (it becomes 16). Draft
// resyncs to the committed value on blur.
//
// Select-all must survive the tap that focuses the field: a bare
// onFocus={select} loses to the browser placing the caret on pointer-up,
// which let typed digits insert mid-number ("60" into "62.5" → "6260.5",
// a real corrupted set caught in the 2026-07 UX benchmark). We select on
// pointer-up (preventing the caret placement) for touch/mouse, and in a
// rAF for keyboard focus.
export default function NumberStepper({ value, onChange, step = 1, min = 0, max = 9999, label, ariaLabel, className = '' }) {
  const [draft, setDraft] = useState(null) // null = mirror committed value
  const selectOnUp = useRef(false)
  const typedSinceFocus = useRef(false)
  const current = Number(value) || 0
  const name = ariaLabel || (typeof label === 'string' ? label : 'value')

  function clamp(n) {
    return Math.min(max, Math.max(min, n))
  }

  function commitStep(delta) {
    setDraft(null)
    onChange(clamp(current + delta))
  }

  function handleType(e) {
    typedSinceFocus.current = true
    const raw = e.target.value
    setDraft(raw)
    if (raw === '') return // let the field sit empty while editing
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) onChange(clamp(parsed))
  }

  return (
    <div className={className}>
      {label && <div className="mb-1 text-center text-xs text-ink-3">{label}</div>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`decrease ${name}`}
          onClick={() => commitStep(-step)}
          className="h-11 w-11 shrink-0 rounded-field border border-line-2 bg-card text-xl font-medium text-ink-2 transition-all duration-100 active:scale-95 active:bg-sunken"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={draft ?? value}
          onChange={handleType}
          onPointerDown={(e) => {
            if (document.activeElement !== e.target) selectOnUp.current = true
          }}
          onPointerUp={(e) => {
            if (selectOnUp.current) {
              selectOnUp.current = false
              e.preventDefault()
              e.target.select()
            }
          }}
          onFocus={(e) => {
            typedSinceFocus.current = false
            // Pointer focus is handled by onPointerUp (which beats the
            // browser's caret placement); this deferred select covers
            // keyboard/tab focus only. It must NEVER fire after typing has
            // started — a late select() makes the next keystroke replace
            // everything typed so far (caught by the verification pass).
            if (selectOnUp.current) return
            const el = e.target
            requestAnimationFrame(() => {
              if (document.activeElement === el && !typedSinceFocus.current) el.select()
            })
          }}
          onBlur={() => setDraft(null)}
          className="h-11 w-full min-w-0 rounded-field border border-line-2 bg-raised text-center text-base font-semibold text-ink tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label={`increase ${name}`}
          onClick={() => commitStep(step)}
          className="h-11 w-11 shrink-0 rounded-field border border-line-2 bg-card text-xl font-medium text-ink-2 transition-all duration-100 active:scale-95 active:bg-sunken"
        >
          +
        </button>
      </div>
    </div>
  )
}
