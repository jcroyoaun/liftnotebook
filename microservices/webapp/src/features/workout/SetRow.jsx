import NumberStepper from '../../components/ui/NumberStepper'
import { kgToDisplay, displayToKg } from '../../lib/units'

const RIR_CHIPS = [0, 1, 2, 3, 4]

// Sanity ceilings: nothing here is a real training weight/rep count, so the
// stepper clamps instead of immortalizing a typo (a 6260.5 kg bench made it
// into history during the 2026-07 benchmark).
const MAX_KG = 500
const MAX_REPS = 100

function fmt(n) {
  const v = Math.round((Number(n) || 0) * 10) / 10
  return String(v)
}

function ghostText(lastSet, unilateral) {
  if (!lastSet) return null
  if (unilateral && lastSet.weight_left != null) {
    return `Last: R ${fmt(lastSet.weight_right)} / L ${fmt(lastSet.weight_left)} kg × ${lastSet.reps}`
  }
  return `Last: ${fmt(lastSet.weight)} kg × ${lastSet.reps}`
}

// One working set: big touch targets, steppers instead of keyboards, RIR as
// tappable chips. Every interaction commits immediately (optimistic +
// debounced sync) — nothing waits for blur. Logging a set is the app's
// signature moment: the row "stamps" green with a spring-in check.
//
// RIR chips SELECT only — tapping the already-selected chip is a no-op. The
// old toggle-to-clear turned "tap 0 to confirm failure" into silent data
// destruction (chips default to 0, so the confirming tap cleared it).
//
// Unilateral exercises get two weight steppers (R and L) on one row — an
// L+R pair is ONE working set. Reps are shared (matched-reps convention:
// the weaker side picks the rep count). Canonical weight = min(L, R), so
// the weak limb governs double progression.
//
// Weight input can flip kg↔lb per exercise (mixed-equipment gyms) — tapping
// the unit label toggles it. Storage stays canonical kg; lb is input-only.
export default function SetRow({ set, lastSet, unilateral, unit, onToggleUnit, onChange, onRecord, onDelete, canDelete }) {
  const maxDisplay = unit === 'lb' ? 1100 : MAX_KG

  const unitToggle = (
    <button
      type="button"
      onClick={onToggleUnit}
      aria-label={`weight unit: ${unit}. Tap to switch`}
      className="inline-flex items-center gap-0.5 rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2 transition-all active:scale-95 active:bg-line"
    >
      {unit}
      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </button>
  )

  function fillFromLast() {
    if (!lastSet) return
    if (unilateral && lastSet.weight_left != null) {
      onChange({
        ...set,
        weight_left: lastSet.weight_left,
        weight_right: lastSet.weight_right,
        weight: Math.min(lastSet.weight_left, lastSet.weight_right),
        reps: lastSet.reps,
      })
    } else {
      onChange({ ...set, weight: lastSet.weight, reps: lastSet.reps })
    }
  }

  const ghost = ghostText(lastSet, unilateral)

  return (
    <div
      className={`border-b border-line px-3 py-2.5 transition-colors duration-300 ${
        set.recorded ? 'bg-ok-wash' : ''
      }`}
    >
      {unilateral ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-5 shrink-0 text-center text-xs text-ink-4 tabular-nums">{set.set_number}</div>
            <NumberStepper
              className="flex-1"
              ariaLabel="right weight"
              label={<span className="inline-flex items-center gap-1"><span className="text-[10px] font-semibold text-ink-2">R</span>{unitToggle}</span>}
              value={kgToDisplay(set.weight_right ?? 0, unit)}
              step={unit === 'lb' ? 5 : 2.5}
              min={0}
              max={maxDisplay}
              onChange={(v) => {
                const right = displayToKg(v, unit)
                const left = set.weight_left ?? 0
                onChange({ ...set, weight_right: right, weight_left: left, weight: Math.min(left, right) })
              }}
            />
            <NumberStepper
              className="flex-1"
              ariaLabel="left weight"
              label={<span className="text-[10px] font-semibold text-ink-2">L</span>}
              value={kgToDisplay(set.weight_left ?? 0, unit)}
              step={unit === 'lb' ? 5 : 2.5}
              min={0}
              max={maxDisplay}
              onChange={(v) => {
                const left = displayToKg(v, unit)
                const right = set.weight_right ?? 0
                onChange({ ...set, weight_left: left, weight_right: right, weight: Math.min(left, right) })
              }}
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
          <div className="mt-2 flex items-center gap-2 pl-7">
            <NumberStepper
              className="w-40"
              label="reps"
              value={set.reps}
              step={1}
              min={1}
              max={MAX_REPS}
              onChange={(v) => onChange({ ...set, reps: v })}
            />
            <span className="text-[11px] leading-tight text-ink-4">one set — both legs, weaker side picks the reps</span>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <div className="w-5 shrink-0 text-center text-xs text-ink-4 tabular-nums">{set.set_number}</div>
          <NumberStepper
            className="flex-1"
            ariaLabel="weight"
            label={unitToggle}
            value={kgToDisplay(set.weight, unit)}
            step={unit === 'lb' ? 5 : 2.5}
            min={0}
            max={maxDisplay}
            onChange={(v) => onChange({ ...set, weight: displayToKg(v, unit) })}
          />
          <NumberStepper
            className="flex-1"
            label="reps"
            value={set.reps}
            step={1}
            min={1}
            max={MAX_REPS}
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
      )}

      {ghost && !set.recorded && (
        <button
          type="button"
          onClick={fillFromLast}
          className="mt-1 pl-7 text-left text-[11px] text-ink-4 transition-colors active:text-accent"
          title="Tap to fill"
        >
          {ghost}
        </button>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="mr-0.5 w-5 text-[10px] font-medium uppercase tracking-wide text-ink-4">RIR</span>
          {RIR_CHIPS.map((rir) => (
            <button
              key={rir}
              type="button"
              onClick={() => {
                if (set.rir !== rir) onChange({ ...set, rir })
              }}
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
