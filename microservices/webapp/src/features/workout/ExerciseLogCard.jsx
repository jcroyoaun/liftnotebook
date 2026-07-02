import SetRow from './SetRow'
import ExerciseDetailButton from '../../components/ExerciseDetailButton'

function formatLast(last) {
  if (!last) return null
  const rir = last.rir != null ? ` @ RIR ${last.rir}` : ''
  return `${last.weight} kg × ${last.reps}${rir}`
}

export default function ExerciseLogCard({ exercise, suggestion, sets, onAddSet, onChangeSet, onRecordSet, onDeleteSet, onOpenPlates }) {
  const recordedCount = sets.filter((s) => s.recorded).length
  const complete = recordedCount >= exercise.target_sets
  const last = suggestion?.last_performance
  const targetLabel = `${suggestion?.target_sets ?? exercise.target_sets} sets · to failure`

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <div className="border-b border-line bg-sunken/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <ExerciseDetailButton
            exerciseId={exercise.exercise_id}
            className="truncate text-left text-[15px] font-semibold text-ink transition-colors hover:text-accent"
          >
            {exercise.exercise_name}
          </ExerciseDetailButton>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">{targetLabel}</span>
            <span className={`text-xs tabular-nums ${complete ? 'font-semibold text-ok' : 'text-ink-3'}`}>
              {complete && <span className="mr-0.5 inline-block animate-stamp">✓</span>}
              {recordedCount}/{exercise.target_sets}
            </span>
            <button
              type="button"
              onClick={() => onOpenPlates(sets[sets.length - 1]?.weight ?? suggestion?.suggested_weight ?? 60)}
              aria-label="plate calculator"
              className="grid h-11 w-9 place-items-center text-ink-3 transition-colors active:text-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9v6m3-8v10m3-12v14m4-14v14m3-12v10m3-8v6" />
              </svg>
            </button>
          </div>
        </div>

        {suggestion && (
          <div className="mt-1.5 text-xs">
            {/* No rep prescriptions — failure decides the reps. Weight is the only cue. */}
            {suggestion.suggested_weight > 0 && (
              <span className="font-medium text-accent">{suggestion.suggested_weight} kg</span>
            )}
            <span className="text-ink-3">{suggestion.suggested_weight > 0 ? ' — ' : ''}{suggestion.reason}</span>
            {last && <div className="mt-0.5 text-ink-3">Last time: {formatLast(last)}</div>}
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
        className="min-h-12 w-full py-2.5 text-sm font-medium text-accent transition-colors active:bg-wash"
      >
        + Add Set
      </button>
    </div>
  )
}
