import NumberStepper from '../../components/ui/NumberStepper'

const RIR_CHIPS = [0, 1, 2, 3, 4]

// One working set: big touch targets, steppers instead of keyboards, RIR as
// tappable chips. Every interaction commits immediately (optimistic +
// debounced sync) — nothing waits for blur. Logging a set is the app's
// signature moment: the row "stamps" green with a spring-in check.
export default function SetRow({ set, onChange, onRecord, onDelete, canDelete }) {
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
          label="kg"
          value={set.weight}
          step={2.5}
          min={0}
          onChange={(v) => onChange({ ...set, weight: v })}
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
