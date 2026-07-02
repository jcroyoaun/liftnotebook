import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getLatestWeeklyVolume } from './dashboardVolume'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import StatTile from '../components/ui/StatTile'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

function getActiveSession() {
  try {
    return JSON.parse(localStorage.getItem('activeSession') || 'null')
  } catch {
    return null
  }
}

export default function Dashboard() {
  const [meso, setMeso] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)
  const [projectedVolume, setProjectedVolume] = useState([])
  const [actualVolume, setActualVolume] = useState([])
  const [sessions, setSessions] = useState([])
  const [confirmAction, setConfirmAction] = useState(null) // 'end' | 'delete' | null
  const navigate = useNavigate()
  const activeSession = getActiveSession()
  const toast = useToast()

  useEffect(() => { loadActive() }, [])

  async function loadActive() {
    try {
      const data = await api.getActiveMesocycle()
      setMeso(data.mesocycle)
      setDays(data.days || [])

      if (data.mesocycle && data.days?.length) {
        loadVolume(data.mesocycle.id, data.days)
        api.getMesocycleSessions(data.mesocycle.id)
          .then(d => setSessions(d.sessions || []))
          .catch(err => console.error('Sessions error:', err))
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
      toast(err.message)
    } finally {
      setStarting(null)
    }
  }

  async function endMeso() {
    try {
      await api.endMesocycle(meso.id)
      setMeso(null)
      setDays([])
      setProjectedVolume([])
      setActualVolume([])
      toast('Training block ended', 'success')
    } catch (err) {
      toast(err.message)
    }
  }

  async function deleteMeso() {
    try {
      await api.deleteMesocycle(meso.id)
      setMeso(null)
      setDays([])
      setProjectedVolume([])
      setActualVolume([])
      toast('Training block deleted', 'success')
    } catch (err) {
      toast(err.message)
    }
  }

  if (loading) return <PageSkeleton />

  const resumeBanner = activeSession && (
    <Link
      to={`/workout/${activeSession.id}`}
      className="block bg-blue-600 text-white rounded-xl px-4 py-3 flex items-center justify-between hover:bg-blue-700"
    >
      <div>
        <div className="text-sm font-semibold">Workout in progress</div>
        <div className="text-xs opacity-80">{activeSession.label}</div>
      </div>
      <span className="text-sm font-medium">Resume →</span>
    </Link>
  )

  if (!meso) {
    return (
      <div className="space-y-4">
        {resumeBanner}
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome!</h2>
          <p className="text-slate-500 mb-6">Create your first training block to start logging workouts.</p>
          <Link to="/programs/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold active:bg-blue-700">
            Create training block
          </Link>
        </div>
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

  // Week stats
  const weekNumber = Math.max(1, Math.floor((Date.now() - new Date(meso.started_at).getTime()) / (7 * 86400_000)) + 1)
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Monday
  const sessionsThisWeek = sessions.filter(s => new Date(s.performed_at) >= weekStart).length
  const setsThisWeek = Math.round(actualVolume.reduce((sum, bp) => sum + bp.total_sets, 0))

  return (
    <div className="space-y-4">
      {resumeBanner}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{meso.name}</h2>
            <p className="text-sm text-slate-500">Week {weekNumber} · {meso.days_per_week} days/week</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setConfirmAction('end')} title="End training block"
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5">
              End
            </button>
            <button onClick={() => setConfirmAction('delete')} title="Delete training block"
              className="text-xs text-red-300 hover:text-red-500 px-2 py-1.5">
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Week at a glance */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="workouts" value={`${sessionsThisWeek}/${meso.days_per_week}`} sub="this week" />
        <StatTile label="sets" value={setsThisWeek} sub="this week" />
        <StatTile label="block week" value={weekNumber} />
      </div>

      {/* Volume summary: actual vs planned */}
      {allBodyParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">This week's volume</h3>
            <Link to={`/programs/${meso.id}/volume`} className="text-[11px] text-blue-600 font-medium">
              Details →
            </Link>
          </div>
          <div className="space-y-2">
            {allBodyParts.map(bp => {
              const planned = projMap[bp] || 0
              const done = actMap[bp] || 0
              const pct = planned > 0 ? Math.min(100, (done / planned) * 100) : done > 0 ? 100 : 0
              return (
                <div key={bp} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 capitalize w-24 truncate">{bp}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2a78d6] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-700 tabular-nums w-12 text-right">
                    {Math.round(done * 10) / 10}
                    <span className="text-slate-400">/{Math.round(planned * 10) / 10}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">working sets done / planned</div>
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
                <Link to={`/programs/${meso.id}/setup/${day.id}`}
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

      <ConfirmSheet
        open={confirmAction === 'end'}
        title="End this training block?"
        body="The block is archived with all its history. You can start a new one right after."
        confirmLabel="End block"
        onConfirm={endMeso}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmSheet
        open={confirmAction === 'delete'}
        title={`Delete "${meso.name}"?`}
        body="This permanently removes the block and every workout logged in it. This cannot be undone."
        confirmLabel="Delete block"
        onConfirm={deleteMeso}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  )
}
