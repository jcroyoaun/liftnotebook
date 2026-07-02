import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import PageHeader from '../components/ui/PageHeader'
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
      <div className="flex items-center gap-2 flex-wrap">
        {days.map((d, i) => (
          <Link key={d.id}
            to={`/programs/${mesoId}/setup/${d.id}`}
            className={`text-xs px-3.5 py-2 rounded-full font-medium transition-colors ${
              i === currentIdx
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 active:bg-slate-50'
            }`}>
            {d.label}
          </Link>
        ))}
      </div>

      {/* Volume preview - day + weekly cumulative */}
      {(dayVolume.length > 0 || weekVolume.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Volume preview</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pr-3 py-0.5 font-medium">Muscle</th>
                <th className="px-2 py-0.5 font-medium text-right">This day</th>
                <th className="pl-2 py-0.5 font-medium text-right">Week total</th>
              </tr>
            </thead>
            <tbody>
              {weekVolume.map(bp => {
                const daySets = dayVolumeMap[bp.body_part] || 0
                return (
                  <tr key={bp.body_part}>
                    <td className="pr-3 py-1 text-slate-600 capitalize">{bp.body_part}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                      {daySets ? Math.round(daySets * 10) / 10 : '–'}
                    </td>
                    <td className="pl-2 py-1 text-right tabular-nums font-semibold text-slate-900">
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
          <div key={`${ex.exercise_id}-${i}`} className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-5 shrink-0 text-center">{i + 1}</span>
              <ExerciseDetailButton
                exerciseId={ex.exercise_id}
                className="flex-1 min-w-0 text-left text-sm font-medium text-slate-800 hover:text-blue-600 truncate"
              >
                {ex.exercise_name}
              </ExerciseDetailButton>
              <button onClick={() => removeExercise(i)} aria-label={`remove ${ex.exercise_name}`}
                className="p-1.5 text-slate-300 active:text-red-500 shrink-0">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 pl-7">
              <span className="text-[11px] text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {ex.target_rep_range_low ?? 8}–{ex.target_rep_range_high ?? 12} reps @ RIR {ex.target_rir ?? 0}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => updateSets(i, ex.target_sets - 1)} aria-label="fewer sets"
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm active:bg-slate-200">−</button>
                <span className="text-sm w-10 text-center tabular-nums">{ex.target_sets} <span className="text-[10px] text-slate-400">sets</span></span>
                <button onClick={() => updateSets(i, ex.target_sets + 1)} aria-label="more sets"
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm active:bg-slate-200">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and add */}
      <div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises to add..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {search && (
          <div className="mt-1 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            {filtered.length === 0 && <p className="p-3 text-sm text-slate-400">No matches</p>}
            {filtered.map(ex => (
              <button key={ex.id} onClick={() => addExercise(ex)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between">
                <span>{ex.name}</span>
                <span className="text-xs text-slate-400">{ex.movement_pattern}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={() => navigate('/')}
          className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium active:bg-slate-50">
          Done
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold active:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : currentIdx < days.length - 1 ? `Save & Next (${days[currentIdx + 1]?.label})` : 'Save & Finish'}
        </button>
      </div>
    </div>
  )
}
