import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import ExerciseArt from '../components/ExerciseArt'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

export default function SetupDayExercises() {
  const { id: mesoId, dayId } = useParams()
  const [exercises, setExercises] = useState([])
  const [allExercises, setAllExercises] = useState([])
  const [day, setDay] = useState(null)
  const [days, setDays] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dayVolume, setDayVolume] = useState([])
  const [weekVolume, setWeekVolume] = useState([])
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    setLoading(true)
    setExercises([])
    setDayVolume([])
    setWeekVolume([])
    Promise.all([api.getExercises(), api.getMesocycle(mesoId)])
      .then(([exData, mesoData]) => {
        setAllExercises(exData.exercises || [])
        setDays(mesoData.days || [])
        const currentDay = (mesoData.days || []).find(d => d.id === parseInt(dayId))
        setDay(currentDay)
        if (currentDay?.exercises?.length) {
          const mapped = currentDay.exercises.map(e => ({
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets,
            target_rep_range_low: e.target_rep_range_low,
            target_rep_range_high: e.target_rep_range_high,
            target_rir: e.target_rir,
          }))
          setExercises(mapped)
        }
      })
      .finally(() => setLoading(false))
  }, [mesoId, dayId])

  // Fetch volume previews whenever exercises change
  const fetchVolume = useCallback(async (exList) => {
    if (exList.length === 0) { setDayVolume([]); setWeekVolume([]); return }

    // Day volume - just this day's exercises
    const dayPayload = exList.map(e => ({ exercise_id: e.exercise_id, sets: e.target_sets }))

    // Week volume - combine this day's exercises with all other days' exercises
    const otherDaysExercises = days
      .filter(d => d.id !== parseInt(dayId))
      .flatMap(d => (d.exercises || []).map(e => ({ exercise_id: e.exercise_id, sets: e.target_sets })))
    const weekPayload = [...dayPayload, ...otherDaysExercises]

    try {
      const [dayData, weekData] = await Promise.all([
        api.previewVolume({ exercises: dayPayload }),
        api.previewVolume({ exercises: weekPayload }),
      ])
      setDayVolume(dayData.volume || [])
      setWeekVolume(weekData.volume || [])
    } catch {
      setDayVolume([])
      setWeekVolume([])
    }
  }, [days, dayId])

  useEffect(() => {
    const timer = setTimeout(() => fetchVolume(exercises), 200)
    return () => clearTimeout(timer)
  }, [exercises, fetchVolume])

  function addExercise(ex) {
    // House defaults: 2 working sets of 8-12 taken to failure.
    setExercises(prev => [...prev, {
      exercise_id: ex.id,
      exercise_name: ex.name,
      target_sets: 2,
      target_rep_range_low: 8,
      target_rep_range_high: 12,
      target_rir: 0,
    }])
    setSearch('')
  }

  function removeExercise(idx) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSets(idx, val) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, target_sets: Math.max(1, val) } : e))
  }

  async function save() {
    setSaving(true)
    try {
      await api.updateDayExercises(dayId, {
        exercises: exercises.map((e, i) => ({
          exercise_id: e.exercise_id,
          position: i + 1,
          target_sets: e.target_sets,
          target_rep_range_low: e.target_rep_range_low,
          target_rep_range_high: e.target_rep_range_high,
          target_rir: e.target_rir,
        }))
      })

      const currentIdx = days.findIndex(d => d.id === parseInt(dayId))
      if (currentIdx < days.length - 1) {
        navigate(`/programs/${mesoId}/setup/${days[currentIdx + 1].id}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      toast(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedIds = new Set(exercises.map(e => e.exercise_id))
  const filtered = allExercises.filter(e =>
    !selectedIds.has(e.id) && e.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }

  const currentIdx = days.findIndex(d => d.id === parseInt(dayId))

  // Build a map for easy lookup: body_part -> day sets
  const dayVolumeMap = {}
  dayVolume.forEach(bp => { dayVolumeMap[bp.body_part] = bp.total_sets })

  return (
    <div className="space-y-4">
      <PageHeader title={day?.label || `Day ${dayId}`} subtitle="Choose exercises and set targets" backTo="/" />

      {/* Day tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {days.map((d, i) => (
          <Link key={d.id}
            to={`/programs/${mesoId}/setup/${d.id}`}
            className={`min-h-10 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
              i === currentIdx
                ? 'bg-ink text-page'
                : 'border border-line-2 bg-card text-ink-2 active:bg-sunken'
            }`}>
            {d.label}
          </Link>
        ))}
      </div>

      {/* Volume preview - day + weekly cumulative */}
      {(dayVolume.length > 0 || weekVolume.length > 0) && (
        <div className="rounded-card border border-line bg-card p-4 shadow-card">
          <h3 className="mb-2 text-sm font-semibold text-ink">Volume preview</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="py-0.5 pr-3 font-medium">Muscle</th>
                <th className="px-2 py-0.5 text-right font-medium">This day</th>
                <th className="py-0.5 pl-2 text-right font-medium">Week total</th>
              </tr>
            </thead>
            <tbody>
              {weekVolume.map(bp => {
                const daySets = dayVolumeMap[bp.body_part] || 0
                return (
                  <tr key={bp.body_part}>
                    <td className="py-1 pr-3 capitalize text-ink-2">{bp.body_part}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-ink-2">
                      {daySets ? Math.round(daySets * 10) / 10 : '–'}
                    </td>
                    <td className="py-1 pl-2 text-right font-semibold tabular-nums text-ink">
                      {Math.round(bp.total_sets * 10) / 10}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected exercises */}
      <div className="space-y-2">
        {exercises.map((ex, i) => (
          <div key={`${ex.exercise_id}-${i}`} className="rounded-card border border-line bg-card px-3 py-2.5 shadow-card">
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs text-ink-4 tabular-nums">{i + 1}</span>
              <ExerciseDetailButton
                exerciseId={ex.exercise_id}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink transition-colors hover:text-accent"
              >
                {ex.exercise_name}
              </ExerciseDetailButton>
              <button onClick={() => removeExercise(i)} aria-label={`remove ${ex.exercise_name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-4 transition-colors active:bg-danger-wash active:text-danger">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between pl-7">
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">
                to failure
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => updateSets(i, ex.target_sets - 1)} aria-label="fewer sets"
                  className="h-9 w-9 rounded-field bg-sunken text-sm text-ink-2 transition-all active:scale-95 active:bg-line">−</button>
                <span className="w-10 text-center text-sm tabular-nums text-ink">{ex.target_sets} <span className="text-[10px] text-ink-4">sets</span></span>
                <button onClick={() => updateSets(i, ex.target_sets + 1)} aria-label="more sets"
                  className="h-9 w-9 rounded-field bg-sunken text-sm text-ink-2 transition-all active:scale-95 active:bg-line">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and add */}
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
              <button key={ex.id} onClick={() => addExercise(ex)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-wash active:bg-wash">
                <ExerciseArt exerciseId={ex.id} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                <span className="shrink-0 text-xs text-ink-4">{ex.movement_pattern}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate('/')} className="min-h-12 px-5">
          Done
        </Button>
        <Button onClick={save} disabled={saving} className="min-h-12 flex-1">
          {saving ? 'Saving…' : currentIdx < days.length - 1 ? `Save & Next (${days[currentIdx + 1]?.label})` : 'Save & Finish'}
        </Button>
      </div>
    </div>
  )
}
