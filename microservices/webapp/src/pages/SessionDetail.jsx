import { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import BottomSheet from '../components/ui/BottomSheet'
import Button from '../components/ui/Button'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'
import { getActiveSession } from '../lib/activeSession'

// Trim trailing zeros off a stored decimal weight: 60.00 → "60", 57.50 → "57.5".
function fmtWeight(v) {
  const n = Number(v)
  return Number.isFinite(n) ? String(parseFloat(n.toFixed(2))) : String(v)
}

// Read-only view of a logged workout. The active session gets a "Continue
// logging" banner; past sessions get an edit escape hatch into the same
// logger, plus editable notes.
export default function SessionDetail() {
  const { id } = useParams()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const toast = useToast()
  const activeSession = getActiveSession()
  const isActive = activeSession && String(activeSession.id) === String(id)

  useEffect(() => {
    api.getSession(id)
      .then(setData)
      .catch(() => setError(true))
  }, [id])

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await api.updateSession(id, { notes: notesDraft.trim() })
      setData((prev) => ({ ...prev, session: { ...prev.session, ...res.session } }))
      setNotesOpen(false)
      toast('Notes saved', 'success')
    } catch (err) {
      toast(err.message)
    } finally {
      setSavingNotes(false)
    }
  }

  if (error) return <div className="py-12 text-center text-danger">Could not load workout.</div>
  if (!data) return <PageSkeleton />

  const { session, sets = [], exercise_notes: exerciseNotes = [] } = data
  const noteByExercise = new Map(
    exerciseNotes.filter((n) => n.note).map((n) => [n.exercise_id, n.note])
  )

  // Group sets by exercise, then order groups by lowest set id — the order
  // the lifter actually logged them (the server may return exercise_id order).
  const byExercise = new Map()
  for (const s of sets) {
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { exerciseId: s.exercise_id, name: s.exercise_name, sets: [] })
    }
    byExercise.get(s.exercise_id).sets.push(s)
  }
  const exercises = [...byExercise.values()]
    .map((ex) => ({
      ...ex,
      firstSetId: Math.min(...ex.sets.map((s) => s.id ?? Number.MAX_SAFE_INTEGER)),
      sets: [...ex.sets].sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => a.firstSetId - b.firstSetId)
  const recordedCount = sets.filter((s) => s.recorded).length

  const subtitleParts = []
  if (session.performed_at) {
    const performed = new Date(session.performed_at)
    subtitleParts.push(
      performed.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      }),
      performed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    )
  }
  subtitleParts.push(`${recordedCount} ${recordedCount === 1 ? 'set' : 'sets'} recorded`)

  return (
    <div className="space-y-4">
      <PageHeader
        title={session.day_label}
        subtitle={subtitleParts.join(' · ')}
        backTo={location.state?.from === 'history' ? '/history' : '/'}
        action={
          !isActive && (
            <Link
              to={`/workout/${id}`}
              state={{ edit: true }}
              className="inline-flex min-h-11 items-center rounded-btn border border-line-2 bg-card px-3.5 text-sm font-semibold text-ink-2 transition-all active:scale-[0.97] active:bg-sunken"
            >
              Edit workout
            </Link>
          )
        }
      />

      {isActive && (
        <Link
          to={`/workout/${id}`}
          className="flex items-center justify-between rounded-card bg-accent-solid px-4 py-3.5 text-on-accent shadow-raised transition-transform active:scale-[0.98]"
        >
          <span className="text-sm font-semibold">This workout is still in progress</span>
          <span className="text-sm font-semibold">Continue logging →</span>
        </Link>
      )}

      {exercises.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-1 font-medium text-ink-2">No sets in this workout</p>
          <p className="text-sm text-ink-3">Nothing was logged for this session.</p>
        </div>
      ) : (
        exercises.map((ex) => (
          <div key={ex.exerciseId} className="overflow-hidden rounded-card border border-line bg-card shadow-card">
            <div className="border-b border-line px-4 py-3">
              <h3 className="text-[15px] font-semibold text-ink">{ex.name}</h3>
              {noteByExercise.has(ex.exerciseId) && (
                <p className="mt-1.5 inline-block max-w-full rounded-field bg-wash px-2 py-1 text-sm text-ink-3">
                  📝 {noteByExercise.get(ex.exerciseId)}
                </p>
              )}
            </div>
            <div className="divide-y divide-line">
              {ex.sets.map((s) => (
                <div key={s.id ?? s.client_id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] text-ink-3">Set {s.set_number}</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-sm font-medium text-ink">
                      {s.weight_left != null && s.weight_right != null
                        ? `R ${fmtWeight(s.weight_right)} / L ${fmtWeight(s.weight_left)} kg × ${s.reps}`
                        : `${s.weight} kg × ${s.reps}`}
                    </span>
                    {s.recorded ? (
                      s.rir != null && (
                        <span className="text-[12px] text-ink-3">RIR {s.rir}</span>
                      )
                    ) : (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-3">not recorded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="rounded-card border border-line bg-card p-4 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Notes</h3>
          <button
            onClick={() => { setNotesDraft(session.notes || ''); setNotesOpen(true) }}
            className="py-1 text-[13px] font-medium text-accent"
          >
            {session.notes ? 'Edit notes' : 'Add notes'}
          </button>
        </div>
        {session.notes ? (
          <p className="whitespace-pre-wrap text-sm text-ink-2">{session.notes}</p>
        ) : (
          <p className="text-sm text-ink-3">How did it go? Sleep, pump, pain — future you will want to know.</p>
        )}
      </div>

      <BottomSheet open={notesOpen} onClose={() => setNotesOpen(false)} title="Session notes">
        <div className="space-y-4">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={5}
            maxLength={2000}
            autoFocus
            placeholder="Bench felt heavy, slept 5h. Swapped rows for pull-ups."
            className="w-full rounded-field border border-line-2 bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <Button onClick={saveNotes} disabled={savingNotes} className="w-full min-h-12">
            {savingNotes ? 'Saving…' : 'Save notes'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
