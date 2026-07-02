import { useState } from 'react'
import NumberStepper from '../../components/ui/NumberStepper'
import { kgToDisplay, displayToKg, getUnitPref, setUnitPref } from '../../lib/units'

const RIR_CHIPS = [0, 1, 2, 3, 4]

// One working set: big touch targets, steppers instead of keyboards, RIR as
// tappable chips. Every interaction commits immediately (optimistic +
// debounced sync) — nothing waits for blur. Logging a set is the app's
// signature moment: the row "stamps" green with a spring-in check.
//
// Weight input can flip kg↔lb per set (mixed-equipment gyms) — tapping the
// unit label toggles it. Storage stays canonical kg; lb is input-only.
export default function SetRow({ set, onChange, onRecord, onDelete, canDelete }) {
  const [unit, setUnit] = useState(() => getUnitPref(set.exercise_id))

  function toggleUnit() {
    const next = unit === 'kg' ? 'lb' : 'kg'
    setUnit(next)
    setUnitPref(set.exercise_id, next)
  }

  return (
    <div
      className={`border-b border-line px-3 py-2.5 transition-colors duration-300 ${
        set.recorded ? 'bg-ok-wash' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 shrink-0 text-center text-xs text-ink-4 tabular-nums">{set.set_number}</div>

        <NumberStepper
          className="flex-1"
          ariaLabel="weight"
          label={
            <button
              type="button"
              onClick={toggleUnit}
              aria-label={`weight unit: ${unit}. Tap to switch`}
              className="inline-flex items-center gap-0.5 rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2 transition-all active:scale-95 active:bg-line"
            >
              {unit}
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          }
          value={kgToDisplay(set.weight, unit)}
          step={unit === 'lb' ? 5 : 2.5}
          min={0}
          onChange={(v) => onChange({ ...set, weight: displayToKg(v, unit) })}
        />
        <NumberStepper
          className="flex-1"
          label="reps"
          value={set.reps}
          step={1}
          min={1}
          onChange={(v) => onChange({ ...set, reps: v })}
        />
        <button
          type="button"
          onClick={() => onDelete(set)}
          disabled={!canDelete}
          aria-label="delete set"
          className="grid h-11 w-8 shrink-0 place-items-center rounded-lg text-ink-4 transition-colors active:text-danger disabled:opacity-30"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="mr-0.5 w-5 text-[10px] font-medium uppercase tracking-wide text-ink-4">RIR</span>
          {RIR_CHIPS.map((rir) => (
            <button
              key={rir}
              type="button"
              onClick={() => onChange({ ...set, rir: set.rir === rir ? null : rir })}
              className={`h-11 w-11 rounded-full text-xs font-medium transition-all active:scale-95 ${
                set.rir === rir
                  ? rir === 0
                    ? 'bg-accent-solid font-semibold text-on-accent'
                    : 'bg-ink font-semibold text-page'
                  : 'bg-sunken text-ink-3 active:bg-line'
              }`}
            >
              {rir}
            </button>
          ))}
        </div>

        {!set.recorded ? (
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(35)
              onRecord(set)
            }}
            className="h-11 shrink-0 rounded-btn bg-accent-solid px-4 text-xs font-semibold text-on-accent transition-all active:scale-[0.96] active:bg-accent-press"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange({ ...set, recorded: false })}
            className="h-11 shrink-0 rounded-btn px-3 text-xs font-semibold text-ok"
          >
            <span className="inline-block animate-stamp">✓</span> Logged
          </button>
        )}
      </div>
    </div>
  )
}
