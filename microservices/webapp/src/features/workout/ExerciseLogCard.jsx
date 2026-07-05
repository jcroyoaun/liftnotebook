import { useState } from 'react'
import SetRow from './SetRow'
import ExerciseDetailButton from '../../components/ExerciseDetailButton'
import { kgToDisplay, getUnitPref, setUnitPref } from '../../lib/units'

function fmtW(n) {
  return String(Math.round((Number(n) || 0) * 10) / 10)
}

function shortDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// "Last time · Jun 20: 90 × 10, 90 × 9 kg" — the FULL per-set picture of the
// previous session, dated. Double progression means beating each set's rep
// count, so one top-set number was never enough to work from.
function formatLastLine(suggestion) {
  const sets = suggestion?.last_sets
  if (sets?.length) {
    const parts = sets.map((ls) =>
      ls.weight_left != null
        ? `R${fmtW(ls.weight_right)}/L${fmtW(ls.weight_left)} × ${ls.reps}`
        : `${fmtW(ls.weight)} × ${ls.reps}`,
    )
    const date = shortDate(suggestion.last_performed_at)
    return `Last time${date ? ` · ${date}` : ''}: ${parts.join(', ')} kg`
  }
  const last = suggestion?.last_performance
  if (!last) return null
  const rir = last.rir != null ? ` @ RIR ${last.rir}` : ''
  return `Last time: ${fmtW(last.weight)} kg × ${last.reps}${rir}`
}

export default function ExerciseLogCard({
  exercise,
  suggestion,
  sets,
  sessionId,
  note,
  pastNotes,
  onAddSet,
  onChangeSet,
  onRecordSet,
  onDeleteSet,
  onOpenPlates,
  onSwap,
  onEditNote,
}) {
  const [unit, setUnit] = useState(() => getUnitPref(exercise.exercise_id))
  const recordedCount = sets.filter((s) => s.recorded).length
  const complete = recordedCount >= exercise.target_sets
  const unilateral = exercise.laterality === 'unilateral'
  const targetLabel = `${suggestion?.target_sets ?? exercise.target_sets} sets · to failure`
  const lastLine = formatLastLine(suggestion)
  const lastByNumber = new Map((suggestion?.last_sets || []).map((ls) => [ls.set_number, ls]))
  // Past notes ride the suggestions payload; the current session's own note
  // renders separately below, so filter it out here.
  const olderNotes = (pastNotes || []).filter((n) => String(n.session_id) !== String(sessionId)).slice(0, 2)

  function toggleUnit() {
    const next = unit === 'kg' ? 'lb' : 'kg'
    setUnit(next)
    setUnitPref(exercise.exercise_id, next)
  }

  const suggestedDisplay =
    suggestion?.suggested_weight > 0
      ? `${kgToDisplay(suggestion.suggested_weight, unit)} ${unit}${unilateral ? ' per side' : ''}`
      : null

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <div className="border-b border-line bg-sunken/60 px-3 py-2.5">
        <ExerciseDetailButton
          exerciseId={exercise.exercise_id}
          className="block w-full text-left text-[15px] font-semibold leading-snug text-ink transition-colors hover:text-accent [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
        >
          {exercise.exercise_name}
        </ExerciseDetailButton>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">{targetLabel}</span>
            <span className={`shrink-0 text-xs tabular-nums ${complete ? 'font-semibold text-ok' : 'text-ink-3'}`}>
              {complete && <span className="mr-0.5 inline-block animate-stamp">✓</span>}
              {recordedCount}/{exercise.target_sets}
            </span>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onEditNote(exercise)}
              aria-label={`note ${exercise.exercise_name}`}
              className={`grid h-11 w-9 place-items-center transition-colors active:text-ink ${note ? 'text-accent' : 'text-ink-3'}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
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
            {onSwap && (
              <button
                type="button"
                onClick={() => onSwap(exercise)}
                aria-label={`swap ${exercise.exercise_name}`}
                className="grid h-11 w-9 place-items-center text-ink-3 transition-colors active:text-ink"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {exercise.swapped_from && (
          <div className="mt-1 text-[11px] text-ink-3">
            Swapped in today — usually {exercise.swapped_from}
          </div>
        )}

        {suggestion && (
          <div className="mt-1.5 text-xs">
            {/* No rep prescriptions — failure decides the reps. Weight is the only cue. */}
            {suggestedDisplay && <span className="font-medium text-accent">{suggestedDisplay}</span>}
            <span className="text-ink-3">{suggestedDisplay ? ' — ' : ''}{suggestion.reason}</span>
            {lastLine && <div className="mt-0.5 text-ink-3">{lastLine}</div>}
          </div>
        )}

        {olderNotes.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {olderNotes.map((n) => (
              <div key={`${n.session_id}`} className="text-[11px] leading-snug text-ink-3">
                <span aria-hidden="true">📝</span> {shortDate(n.performed_at)} — {n.note}
              </div>
            ))}
          </div>
        )}

        {/* The note affordance must be readable text, not just the header
            pencil — the owner stood in the gym unable to find it. */}
        {note ? (
          <button
            type="button"
            onClick={() => onEditNote(exercise)}
            className="mt-1.5 block w-full rounded-field bg-wash px-2 py-1 text-left text-[12px] leading-snug text-ink-2 active:bg-sunken"
          >
            <span aria-hidden="true">📝</span> {note}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onEditNote(exercise)}
            className="mt-1.5 block w-full px-1 py-1 text-left text-[12px] leading-snug text-ink-4 transition-colors active:text-accent"
          >
            <span aria-hidden="true">📝</span> Add note — machine, seat, grip…
          </button>
        )}
      </div>

      {/* Slot-keyed: a draft graduating into a synced row keeps its key, so
          the inputs never remount mid-typing (focus/keystroke preservation). */}
      {sets.map((set) => (
        <SetRow
          key={`slot-${set.exercise_id}-${set.set_number}`}
          set={set}
          lastSet={lastByNumber.get(set.set_number)}
          unilateral={unilateral}
          unit={unit}
          onToggleUnit={toggleUnit}
          onChange={onChangeSet}
          onRecord={onRecordSet}
          onDelete={onDeleteSet}
          canDelete={set.draft === true || set.id != null}
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
