import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

const PRESETS = [
  { label: 'PPL', days: ['Push', 'Pull', 'Legs'] },
  { label: 'PPL x2', days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'] },
  { label: 'Upper/Lower', days: ['Upper', 'Lower', 'Upper', 'Lower'] },
  { label: 'Full Body', days: ['Full Body A', 'Full Body B', 'Full Body C'] },
]

function blankDay(n) {
  return { day_number: n, label: `Day ${n}`, exercises: [] }
}

// Admin: build or edit a shared program template. Same day-by-day flow as the
// personal block builder, but everything lives on one page.
export default function AdminTemplateEditor() {
  const { id } = useParams()
  const editing = !!id
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState([blankDay(1), blankDay(2), blankDay(3)])
  const [activeDay, setActiveDay] = useState(0)
  const [allExercises, setAllExercises] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  // Guard against losing authoring work: any edit after load flips dirty,
  // and leaving (Back link or Cancel) asks before discarding.
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [pendingPreset, setPendingPreset] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    api.getExercises()
      .then(data => setAllExercises(data.exercises || []))
      .catch(err => toast(err.message))
  }, [toast])

  useEffect(() => {
    if (!editing) return
    api.getTemplate(id)
      .then(({ template }) => {
        setName(template.name)
        setDescription(template.description || '')
        setDays((template.days || []).map(d => ({
          day_number: d.day_number,
          label: d.label,
          exercises: (d.exercises || []).map(e => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets,
            target_rep_range_low: e.target_rep_range_low,
            target_rep_range_high: e.target_rep_range_high,
            target_rir: e.target_rir,
          })),
        })))
      })
      .catch(err => toast(err.message))
      .finally(() => setLoading(false))
  }, [editing, id, toast])

  function setDayCount(n) {
    setDays(prev => {
      const next = [...prev]
      while (next.length < n) next.push(blankDay(next.length + 1))
      return next.slice(0, n)
    })
    setActiveDay(a => Math.min(a, n - 1))
    setDirty(true)
  }

  function applyPreset(p) {
    setDays(p.days.map((label, i) => ({ day_number: i + 1, label, exercises: [] })))
    setActiveDay(0)
    setDirty(true)
  }

  // Presets wipe every day: once real exercises exist, confirm first.
  function requestPreset(p) {
    if (days.some(d => d.exercises.length > 0)) {
      setPendingPreset(p)
    } else {
      applyPreset(p)
    }
  }

  function requestLeave() {
    if (dirty) {
      setConfirmDiscard(true)
    } else {
      navigate('/admin/templates')
    }
  }

  function updateDay(idx, patch) {
    setDays(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
    setDirty(true)
  }

  function addExercise(ex) {
    // House defaults: 2 working sets of 8-12 taken to failure.
    updateDay(activeDay, {
      exercises: [...days[activeDay].exercises, {
        exercise_id: ex.id,
        exercise_name: ex.name,
        target_sets: 2,
        target_rep_range_low: 8,
        target_rep_range_high: 12,
        target_rir: 0,
      }],
    })
    setSearch('')
  }

  function removeExercise(idx) {
    updateDay(activeDay, { exercises: days[activeDay].exercises.filter((_, i) => i !== idx) })
  }

  function updateSets(idx, val) {
    updateDay(activeDay, {
      exercises: days[activeDay].exercises.map((e, i) =>
        i === idx ? { ...e, target_sets: Math.max(1, val) } : e
      ),
    })
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        name,
        description,
        days_per_week: days.length,
        days: days.map((d, i) => ({
          day_number: i + 1,
          label: d.label,
          exercises: d.exercises.map((e, j) => ({
            exercise_id: e.exercise_id,
            position: j + 1,
            target_sets: e.target_sets,
            target_rep_range_low: e.target_rep_range_low,
            target_rep_range_high: e.target_rep_range_high,
            target_rir: e.target_rir,
          })),
        })),
      }
      if (editing) {
        await api.updateTemplate(id, body)
      } else {
        await api.createTemplate(body)
      }
      toast(editing ? 'Template updated' : 'Template published', 'success')
      navigate('/admin/templates')
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  const day = days[activeDay]
  const selectedIds = new Set(day.exercises.map(e => e.exercise_id))
  // Prefix matches outrank substring matches so "tricep" surfaces the
  // Tricep... variants before every ...Triceps Pushdown lookalike.
  const q = search.trim().toLowerCase()
  const filtered = allExercises
    .filter(e => !selectedIds.has(e.id) && e.name.toLowerCase().includes(q))
    .sort((a, b) =>
      (a.name.toLowerCase().startsWith(q) ? 0 : 1) - (b.name.toLowerCase().startsWith(q) ? 0 : 1)
    )
  const firstEmptyDay = days.findIndex(d => d.exercises.length === 0)
  const canSave =
    name.trim() !== '' && days.every(d => d.label.trim() !== '') && firstEmptyDay === -1

  return (
    <div className="space-y-4">
      {/* Intercept the Back link while dirty so edits aren't lost silently. */}
      <div
        onClickCapture={e => {
          if (!dirty) return
          if (e.target.closest?.('a')) {
            e.preventDefault()
            e.stopPropagation()
            setConfirmDiscard(true)
          }
        }}
      >
        <PageHeader
          title={editing ? 'Edit template' : 'New template'}
          subtitle="Published to everyone's template browser"
          backTo="/admin/templates"
        />
        {editing && (
          <p className="mt-1.5 text-[13px] text-ink-3">
            Changes apply to new starts — blocks already running keep their copy.
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-card border border-line bg-card p-4 shadow-card">
        <Input
          label="Template name"
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true) }}
          required
          placeholder="e.g., House PPL"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Description</label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setDirty(true) }}
            rows={2}
            placeholder="Who it's for, how to run it"
            className="w-full rounded-field border border-line-2 bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => requestPreset(p)}
                className="min-h-10 rounded-full border border-line-2 bg-card px-3.5 py-2 text-xs font-medium text-ink-2 transition-all active:scale-[0.97] active:bg-sunken"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Days per week</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setDayCount(n)}
                className={`h-11 flex-1 rounded-field text-sm font-medium transition-all active:scale-[0.95] ${
                  n === days.length
                    ? 'bg-accent-solid font-semibold text-on-accent'
                    : 'bg-sunken text-ink-2 active:bg-line'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {days.map((d, i) => (
          <button
            key={i}
            onClick={() => { setActiveDay(i); setSearch('') }}
            className={`min-h-10 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
              i === activeDay
                ? 'bg-ink text-page'
                : 'border border-line-2 bg-card text-ink-2 active:bg-sunken'
            }`}
          >
            {d.label || `Day ${i + 1}`}
            <span className="ml-1.5 text-[10px] opacity-70">{d.exercises.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-card border border-line bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs text-ink-3">Day {activeDay + 1}</span>
          <Input
            type="text"
            value={day.label}
            onChange={e => updateDay(activeDay, { label: e.target.value })}
            onFocus={e => e.target.select()}
            required
            placeholder={`Day ${activeDay + 1}`}
            className="flex-1"
          />
        </div>

        <div className="space-y-2">
          {day.exercises.map((ex, i) => (
            <div key={`${ex.exercise_id}-${i}`} className="rounded-field border border-line bg-raised px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-ink-4 tabular-nums">{i + 1}</span>
                <ExerciseDetailButton
                  exerciseId={ex.exercise_id}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink transition-colors hover:text-accent"
                >
                  {ex.exercise_name}
                </ExerciseDetailButton>
                <button
                  onClick={() => removeExercise(i)}
                  aria-label={`remove ${ex.exercise_name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-4 transition-colors active:bg-danger-wash active:text-danger"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between pl-7">
                <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">to failure</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateSets(i, ex.target_sets - 1)}
                    aria-label="fewer sets"
                    className="h-9 w-9 rounded-field bg-sunken text-sm text-ink-2 transition-all active:scale-95 active:bg-line"
                  >−</button>
                  <span className="w-10 text-center text-sm tabular-nums text-ink">
                    {ex.target_sets} <span className="text-[10px] text-ink-4">sets</span>
                  </span>
                  <button
                    onClick={() => updateSets(i, ex.target_sets + 1)}
                    aria-label="more sets"
                    className="h-9 w-9 rounded-field bg-sunken text-sm text-ink-2 transition-all active:scale-95 active:bg-line"
                  >+</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises to add..."
          />
          {search && (
            <div className="mt-1 max-h-48 overflow-y-auto rounded-field border border-line bg-card shadow-raised">
              {filtered.length === 0 && <p className="p-3 text-sm text-ink-3">No matches</p>}
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-wash active:bg-wash"
                >
                  <span className="min-w-0 flex-1 line-clamp-2">{ex.name}</span>
                  <span className="shrink-0 text-xs text-ink-4">{ex.movement_pattern}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={requestLeave} className="min-h-12 px-5">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !canSave} className="min-h-12 flex-1">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish template'}
          </Button>
        </div>
        {firstEmptyDay !== -1 && (
          <p className="text-center text-[13px] text-ink-3">
            Day {firstEmptyDay + 1} has no exercises yet.
          </p>
        )}
      </div>

      <ConfirmSheet
        open={confirmDiscard}
        title="Discard this template?"
        body="Your edits here will be lost."
        confirmLabel="Discard"
        onConfirm={() => navigate('/admin/templates')}
        onClose={() => setConfirmDiscard(false)}
      />

      <ConfirmSheet
        open={!!pendingPreset}
        title="Apply preset?"
        body="This replaces your current days and exercises."
        confirmLabel="Replace"
        onConfirm={() => applyPreset(pendingPreset)}
        onClose={() => setPendingPreset(null)}
      />
    </div>
  )
}
