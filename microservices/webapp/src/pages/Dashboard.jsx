import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getLatestWeeklyVolume } from './dashboardVolume'
import ExerciseDetailButton from '../components/ExerciseDetailButton'

export default function Dashboard() {
  const [meso, setMeso] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)
  const [projectedVolume, setProjectedVolume] = useState([])
  const [actualVolume, setActualVolume] = useState([])
  const navigate = useNavigate()

  useEffect(() => { loadActive() }, [])

  async function loadActive() {
    try {
      const data = await api.getActiveMesocycle()
      setMeso(data.mesocycle)
      setDays(data.days || [])

      if (data.mesocycle && data.days?.length) {
        loadVolume(data.mesocycle.id, data.days)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadVolume(mesoId, daysList) {
    // Build projected volume from all training day templates
    const allExercises = daysList.flatMap(d =>
      (d.exercises || []).map(e => ({ exercise_id: e.exercise_id, sets: e.target_sets }))
    )

    // Fetch projected and actual independently so one failure doesn't kill both
    if (allExercises.length > 0) {
      try {
        const data = await api.previewVolume({ exercises: allExercises })
        setProjectedVolume(data.volume || [])
      } catch (err) {
        console.error('Projected volume error:', err)
      }
    }

    try {
      const data = await api.getWeeklyVolume(mesoId)
      setActualVolume(getLatestWeeklyVolume(data.weekly_volume || []))
    } catch (err) {
      console.error('Actual volume error:', err)
    }
  }

  async function startWorkout(day) {
    setStarting(day.id)
    try {
      const data = await api.createSession({
        mesocycle_id: meso.id,
        training_day_id: day.id,
      })
      navigate(`/workout/${data.session.id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setStarting(null)
    }
  }

  async function endMeso() {
    if (!confirm('End this mesocycle? You can start a new one after.')) return
    try {
      await api.endMesocycle(meso.id)
      setMeso(null)
      setDays([])
      setProjectedVolume([])
      setActualVolume([])
    } catch (err) {
      alert(err.message)
    }
  }

  async function deleteMeso() {
    if (!confirm(`Delete "${meso.name}"? This will permanently remove all workout data.`)) return
    try {
      await api.deleteMesocycle(meso.id)
      setMeso(null)
      setDays([])
      setProjectedVolume([])
      setActualVolume([])
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  if (!meso) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome!</h2>
        <p className="text-slate-500 mb-6">Create your first mesocycle to start tracking workouts.</p>
        <Link to="/mesocycle/new"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700">
          Create Mesocycle
        </Link>
      </div>
    )
  }

  // Build volume comparison data
  const projMap = {}
  projectedVolume.forEach(bp => { projMap[bp.body_part] = bp.total_sets })
  const actMap = {}
  actualVolume.forEach(bp => { actMap[bp.body_part] = bp.total_sets })
  const allBodyParts = [...new Set([
    ...Object.keys(projMap),
    ...Object.keys(actMap),
  ])].sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{meso.name}</h2>
          <p className="text-sm text-slate-500">{meso.days_per_week} days/week</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/mesocycle/${meso.id}/volume`}
            className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200">
            Volume
          </Link>
          <button onClick={endMeso}
            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100">
            End Meso
          </button>
          <button onClick={deleteMeso}
            className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100">
            Delete
          </button>
        </div>
      </div>

      {/* Volume summary: projected vs actual */}
      {allBodyParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Weekly Volume (sets per muscle group)
          </h3>
          <div className="space-y-1.5">
            {allBodyParts.map(bp => {
              const planned = projMap[bp] || 0
              const done = actMap[bp] || 0
              const pct = planned > 0 ? Math.min(100, (done / planned) * 100) : 0
              return (
                <div key={bp} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700 capitalize w-24 truncate">{bp}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    {/* Planned marker line */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-full border-r-2 border-dashed border-slate-400" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-600 w-20 text-right">
                    {Math.round(done * 10) / 10}
                    <span className="text-slate-400"> / {Math.round(planned * 10) / 10}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-blue-500 rounded-sm inline-block" /> Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-slate-100 border border-slate-300 rounded-sm inline-block" /> Planned
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {days.map(day => (
          <div key={day.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">
                Day {day.day_number}: {day.label}
              </h3>
              <div className="flex gap-2">
                <Link to={`/mesocycle/${meso.id}/setup/${day.id}`}
                  className="text-xs text-slate-500 hover:text-slate-700">
                  Edit
                </Link>
                <button
                  onClick={() => startWorkout(day)}
                  disabled={starting === day.id}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {starting === day.id ? 'Starting...' : 'Start Workout'}
                </button>
              </div>
            </div>
            {day.exercises && day.exercises.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {day.exercises.map(ex => (
                  <ExerciseDetailButton
                    key={ex.id}
                    exerciseId={ex.exercise_id}
                    className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {ex.exercise_name}
                    <span className="text-slate-400 ml-1">{ex.target_sets}s</span>
                  </ExerciseDetailButton>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No exercises assigned yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
