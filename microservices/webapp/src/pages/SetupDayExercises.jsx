import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'

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
    setExercises(prev => [...prev, {
      exercise_id: ex.id,
      exercise_name: ex.name,
      target_sets: 2,
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
        }))
      })

      const currentIdx = days.findIndex(d => d.id === parseInt(dayId))
      if (currentIdx < days.length - 1) {
        navigate(`/mesocycle/${mesoId}/setup/${days[currentIdx + 1].id}`)
      } else {
        navigate('/')
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedIds = new Set(exercises.map(e => e.exercise_id))
  const filtered = allExercises.filter(e =>
    !selectedIds.has(e.id) && e.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  const currentIdx = days.findIndex(d => d.id === parseInt(dayId))

  // Build a map for easy lookup: body_part -> day sets
  const dayVolumeMap = {}
  dayVolume.forEach(bp => { dayVolumeMap[bp.body_part] = bp.total_sets })

  // Collect all body parts from both day and week
  const allBodyParts = [...new Set([
    ...weekVolume.map(bp => bp.body_part),
    ...dayVolume.map(bp => bp.body_part),
  ])]

  return (
    <div className="space-y-4">
      {/* Day tabs - clickable for navigation */}
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {days.map((d, i) => (
            <Link key={d.id}
              to={`/mesocycle/${mesoId}/setup/${d.id}`}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                i === currentIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {d.label}
            </Link>
          ))}
        </div>
        <h2 className="text-lg font-bold text-slate-800">
          Setup: {day?.label || `Day ${dayId}`}
        </h2>
      </div>

      {/* Volume preview - day + weekly cumulative */}
      {(dayVolume.length > 0 || weekVolume.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
            Volume (sets per muscle group)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pr-3 py-0.5 font-medium">Muscle</th>
                  <th className="px-2 py-0.5 font-medium text-right">This Day</th>
                  <th className="pl-2 py-0.5 font-medium text-right">Week Total</th>
                </tr>
              </thead>
              <tbody>
                {weekVolume.map(bp => {
                  const daySets = dayVolumeMap[bp.body_part] || 0
                  return (
                    <tr key={bp.body_part}>
                      <td className="pr-3 py-0.5 font-medium text-slate-700 capitalize">{bp.body_part}</td>
                      <td className="px-2 py-0.5 text-right font-mono text-blue-700">
                        {daySets ? Math.round(daySets * 10) / 10 : '-'}
                      </td>
                      <td className="pl-2 py-0.5 text-right font-mono text-blue-900 font-semibold">
                        {Math.round(bp.total_sets * 10) / 10}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected exercises */}
      <div className="space-y-2">
        {exercises.map((ex, i) => (
          <div key={`${ex.exercise_id}-${i}`} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
            <span className="text-xs text-slate-400 w-5">{i + 1}</span>
            <ExerciseDetailButton
              exerciseId={ex.exercise_id}
              className="flex-1 text-left text-sm font-medium text-slate-800 hover:text-blue-600"
            >
              {ex.exercise_name}
            </ExerciseDetailButton>
            <div className="flex items-center gap-1">
              <button onClick={() => updateSets(i, ex.target_sets - 1)}
                className="w-6 h-6 rounded bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">-</button>
              <span className="text-sm w-8 text-center">{ex.target_sets}</span>
              <button onClick={() => updateSets(i, ex.target_sets + 1)}
                className="w-6 h-6 rounded bg-slate-100 text-slate-600 text-xs hover:bg-slate-200">+</button>
              <span className="text-xs text-slate-400 ml-1">sets</span>
            </div>
            <button onClick={() => removeExercise(i)} className="text-red-400 hover:text-red-600 text-sm ml-2">x</button>
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
          className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
          Dashboard
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : currentIdx < days.length - 1 ? `Save & Next (${days[currentIdx + 1]?.label})` : 'Save & Finish'}
        </button>
      </div>
    </div>
  )
}
