import SetRow from './SetRow'
import ExerciseDetailButton from '../../components/ExerciseDetailButton'

function formatLast(last) {
  if (!last) return null
  const rir = last.rir != null ? ` @ RIR ${last.rir}` : ''
  return `${last.weight} kg × ${last.reps}${rir}`
}

export default function ExerciseLogCard({ exercise, suggestion, sets, onAddSet, onChangeSet, onRecordSet, onDeleteSet, onOpenPlates }) {
  const recordedCount = sets.filter((s) => s.recorded).length
  const last = suggestion?.last_performance
  const targetLabel = suggestion
    ? `${suggestion.target_sets}×${suggestion.target_rep_range_low}–${suggestion.target_rep_range_high} @ RIR ${suggestion.target_rir}`
    : `${exercise.target_sets} sets`

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <ExerciseDetailButton
            exerciseId={exercise.exercise_id}
            className="text-left text-sm font-semibold text-slate-800 hover:text-blue-600 truncate"
          >
            {exercise.exercise_name}
          </ExerciseDetailButton>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-500 bg-slate-200/70 rounded-full px-2 py-0.5">{targetLabel}</span>
            <span className="text-xs text-slate-400">{recordedCount}/{exercise.target_sets}</span>
            <button
              type="button"
              onClick={() => onOpenPlates(sets[sets.length - 1]?.weight ?? suggestion?.suggested_weight ?? 60)}
              aria-label="plate calculator"
              className="p-1.5 text-slate-400 active:text-slate-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9v6m3-8v10m3-12v14m4-14v14m3-12v10m3-8v6" />
              </svg>
            </button>
          </div>
        </div>

        {suggestion && (
          <div className="mt-1.5 text-xs">
            {suggestion.suggested_weight > 0 ? (
              <span className="text-blue-700 font-medium">
                Target: {suggestion.suggested_weight} kg × {suggestion.suggested_reps}
              </span>
            ) : (
              <span className="text-blue-700 font-medium">Target: {suggestion.suggested_reps}+ reps to failure</span>
            )}
            <span className="text-slate-400"> — {suggestion.reason}</span>
            {last && <div className="text-slate-400 mt-0.5">Last time: {formatLast(last)}</div>}
          </div>
        )}
      </div>

      {sets.map((set) => (
        <SetRow
          key={set.client_id ?? `srv-${set.id}`}
          set={set}
          onChange={onChangeSet}
          onRecord={onRecordSet}
          onDelete={onDeleteSet}
          canDelete={set.id != null}
        />
      ))}

      <button
        type="button"
        onClick={() => onAddSet(exercise, suggestion)}
        className="w-full py-2.5 text-sm text-blue-600 active:bg-blue-50 font-medium"
      >
        + Add Set
      </button>
    </div>
  )
}
