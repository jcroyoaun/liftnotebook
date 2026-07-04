import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import ExerciseArt from '../components/ExerciseArt'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
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
  }

  function applyPreset(p) {
    setDays(p.days.map((label, i) => ({ day_number: i + 1, label, exercises: [] })))
    setActiveDay(0)
  }

  function updateDay(idx, patch) {
    setDays(prev => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
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
  const filtered = allExercises.filter(e =>
    !selectedIds.has(e.id) && e.name.toLowerCase().includes(search.toLowerCase())
  )
  const canSave = name.trim() !== '' && days.every(d => d.label.trim() !== '')

  return (
    <div className="space-y-4">
      <PageHeader
        title={editing ? 'Edit template' : 'New template'}
        subtitle="Published to everyone's template browser"
        backTo="/admin/templates"
      />

      <div className="space-y-4 rounded-card border border-line bg-card p-4 shadow-card">
        <Input
          label="Template name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="e.g., House PPL"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
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
                onClick={() => applyPreset(p)}
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
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-wash active:bg-wash"
                >
                  <ExerciseArt exerciseId={ex.id} className="h-9 w-9 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                  <span className="shrink-0 text-xs text-ink-4">{ex.movement_pattern}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate('/admin/templates')} className="min-h-12 px-5">
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !canSave} className="min-h-12 flex-1">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish template'}
        </Button>
      </div>
    </div>
  )
}
