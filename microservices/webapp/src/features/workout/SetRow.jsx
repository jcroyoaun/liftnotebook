import NumberStepper from '../../components/ui/NumberStepper'

const RIR_CHIPS = [0, 1, 2, 3, 4]

// One working set: big touch targets, steppers instead of keyboards, RIR as
// tappable chips. Every interaction commits immediately (optimistic +
// debounced sync) — nothing waits for blur.
export default function SetRow({ set, onChange, onRecord, onDelete, canDelete }) {
  return (
    <div className={`px-3 py-2 border-b border-slate-50 ${set.recorded ? 'bg-green-50' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="w-5 shrink-0 text-xs text-slate-400 text-center">{set.set_number}</div>

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
      </div>

      <div className="flex items-center justify-between mt-1.5 pl-7">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-400 mr-1">RIR</span>
          {RIR_CHIPS.map((rir) => (
            <button
              key={rir}
              type="button"
              onClick={() => onChange({ ...set, rir: set.rir === rir ? null : rir })}
              className={`h-8 w-8 rounded-full text-xs font-medium ${
                set.rir === rir
                  ? rir === 0
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 active:bg-slate-200'
              }`}
            >
              {rir}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {!set.recorded ? (
            <button
              type="button"
              onClick={() => onRecord(set)}
              className="h-8 px-4 rounded-lg bg-green-600 text-white text-xs font-semibold active:bg-green-700"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ ...set, recorded: false })}
              className="h-8 px-3 rounded-lg text-green-700 text-xs font-medium"
            >
              ✓ Logged
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(set)}
            disabled={!canDelete}
            aria-label="delete set"
            className="h-8 w-8 rounded text-slate-300 active:text-red-500 disabled:opacity-30"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
