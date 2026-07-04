import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getUser } from '../auth/session'
import { getLatestWeeklyVolume } from './dashboardVolume'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import StatTile from '../components/ui/StatTile'
import Button from '../components/ui/Button'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'
import { useChartTheme } from '../lib/chartTheme'

export default function Dashboard() {
  const [meso, setMeso] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)
  const [projectedVolume, setProjectedVolume] = useState([])
  const [actualVolume, setActualVolume] = useState([])
  const [sessions, setSessions] = useState([])
  const [confirmAction, setConfirmAction] = useState(null) // 'end' | 'delete' | null
  // Per-day expand/collapse overrides. Unset days fall back to the smart
  // default (the suggested next day opens), so the badge is a default, not
  // a dictator — any combination of days can be open at once.
  const [dayOverrides, setDayOverrides] = useState({})
  const navigate = useNavigate()
  const toast = useToast()
  const { chart } = useChartTheme()

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

  if (!meso) {
    const firstName = (getUser()?.name || '').split(' ')[0]
    return (
      <div className="space-y-4">
        <div className="py-16 text-center animate-rise">
          <h2 className="font-display mb-2 text-[26px] font-semibold text-ink">
            Welcome{firstName ? `, ${firstName}` : ''}!
          </h2>
          <p className="mx-auto mb-8 max-w-64 text-[15px] text-ink-3">
            Every good block starts on paper. Create yours to start logging workouts.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              to="/programs/new"
              className="inline-flex min-h-12 items-center justify-center rounded-btn bg-accent-solid px-6 text-sm font-semibold text-on-accent transition-all active:scale-[0.97] active:bg-accent-press"
            >
              Create training block
            </Link>
            <Link to="/programs/templates" className="text-sm font-medium text-accent hover:underline">
              or start from a template
            </Link>
          </div>
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

  // Only sessions with recorded work count anywhere below — Start Workout
  // creates the session row up front, so an abandoned empty session must not
  // mark a day done, advance "Up next", or pad the stats.
  const trained = sessions.filter(s => (s.recorded_sets ?? 0) > 0)

  // Week stats
  const weekNumber = Math.max(1, Math.floor((Date.now() - new Date(meso.started_at).getTime()) / (7 * 86400_000)) + 1)
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Monday
  const sessionsThisWeek = trained.filter(s => new Date(s.performed_at) >= weekStart).length
  const setsThisWeek = Math.round(actualVolume.reduce((sum, bp) => sum + bp.total_sets, 0))

  // Consistency streak: consecutive Monday-weeks with at least one workout,
  // counting back from this week. A quiet current week doesn't break the
  // streak until it's over — last week's streak carries through.
  const WEEK_MS = 7 * 86400_000
  const weeksWithSessions = new Set(
    trained.map(s => Math.floor((new Date(s.performed_at).getTime() - weekStart.getTime()) / WEEK_MS))
  ) // 0 = this week, -1 = last week, ...
  let streakWeeks = 0
  for (let w = weeksWithSessions.has(0) ? 0 : -1; weeksWithSessions.has(w); w--) streakWeeks++

  // Suggested next day: the one after the most recently logged session
  // (cyclic). Days always render in program order — this only places a badge
  // and expands one card; completing a day never reorders the list.
  const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number)
  const lastSession = trained.reduce(
    (latest, s) => (!latest || new Date(s.performed_at) > new Date(latest.performed_at) ? s : latest),
    null
  )
  const lastDayNumber = lastSession
    ? sortedDays.find(d => d.id === lastSession.training_day_id)?.day_number ?? 0
    : 0
  const nextDay = sortedDays.length
    ? sortedDays.find(d => d.day_number === (lastDayNumber % sortedDays.length) + 1) || sortedDays[0]
    : null
  const doneDayIds = new Set(
    trained.filter(s => new Date(s.performed_at) >= weekStart).map(s => s.training_day_id)
  )

  const todayLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const firstName = (getUser()?.name || '').split(' ')[0]
  const hour = new Date().getHours()
  const daypart = hour < 5 ? 'Late night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const greetingLine = firstName ? `${daypart}, ${firstName} · ${todayLine}` : todayLine

  return (
    <div className="space-y-5">
      {/* Block header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">{greetingLine}</div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setConfirmAction('end')}
              title="End training block"
              className="min-h-8 rounded-btn px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink-2"
            >
              End
            </button>
            <button
              onClick={() => setConfirmAction('delete')}
              title="Delete training block"
              className="min-h-8 rounded-btn px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-wash"
            >
              Delete
            </button>
          </div>
        </div>
        <h2 className="font-display text-[28px] font-semibold leading-tight text-ink">{meso.name}</h2>
        <p className="mt-0.5 text-sm text-ink-3">Week {weekNumber} · {meso.days_per_week} days/week</p>
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent-solid transition-all duration-500"
              style={{ width: `${Math.min(100, (sessionsThisWeek / meso.days_per_week) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 text-right text-[11px] text-ink-3 tabular-nums">
            {sessionsThisWeek} of {meso.days_per_week} sessions this week
          </div>
        </div>
      </div>

      {/* Week at a glance */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="workouts" value={`${sessionsThisWeek}/${meso.days_per_week}`} sub="this week" />
        <StatTile label="sets" value={setsThisWeek} sub="this week" />
        <StatTile
          label="week streak"
          value={streakWeeks}
          sub={streakWeeks >= 2 ? 'keep it rolling' : 'in a row'}
        />
      </div>

      {/* The split, always in program order — completing a day never
          reorders the list. The suggested day is badged and opens by
          default; every card expands/collapses independently. */}
      {sortedDays.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">This block</h3>
          <div className="space-y-2.5">
            {sortedDays.map(day => {
              const isNext = day.id === nextDay?.id
              const isDone = doneDayIds.has(day.id)
              const open = dayOverrides[day.id] ?? isNext
              const doneChip = isDone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok-wash px-2 py-0.5 text-[11px] font-medium text-ok">
                  ✓ Done
                </span>
              )
              return (
                <div key={day.id} className="overflow-hidden rounded-card border border-line bg-card shadow-card">
                  <div className={`px-4 py-3 ${open ? 'border-b border-line' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setDayOverrides(prev => ({ ...prev, [day.id]: !open }))}
                        aria-expanded={open}
                        aria-label={`toggle Day ${day.day_number}: ${day.label}`}
                        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <svg
                          className={`h-4 w-4 shrink-0 text-ink-4 transition-transform ${open ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <h3 className={`truncate font-semibold text-ink ${open ? 'font-display text-[17px]' : 'text-[15px]'}`}>
                          Day {day.day_number}: {day.label}
                        </h3>
                        {doneChip}
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isNext && (
                          <span className="inline-flex items-center rounded-full bg-wash px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">
                            Up next
                          </span>
                        )}
                        <Link
                          to={`/programs/${meso.id}/setup/${day.id}`}
                          className="min-h-8 rounded-btn px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink-2"
                        >
                          Edit
                        </Link>
                        {!open && (
                          <button
                            onClick={() => startWorkout(day)}
                            disabled={starting === day.id}
                            className="min-h-8 rounded-btn border border-line-2 bg-card px-3 py-1 text-xs font-semibold text-ink transition-all hover:bg-sunken active:scale-[0.97] disabled:opacity-50"
                          >
                            {starting === day.id ? 'Starting...' : 'Start Workout'}
                          </button>
                        )}
                      </div>
                    </div>
                    {!open && (
                      day.exercises && day.exercises.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {day.exercises.map(ex => (
                            <ExerciseDetailButton
                              key={ex.id}
                              exerciseId={ex.exercise_id}
                              className="inline-flex items-center rounded-md bg-sunken px-2 py-1 text-xs text-ink-2 transition-colors hover:bg-wash hover:text-accent"
                            >
                              {ex.exercise_name}
                              <span className="ml-1 text-ink-4">{ex.target_sets}s</span>
                            </ExerciseDetailButton>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-ink-3">No exercises assigned yet</p>
                      )
                    )}
                    {open && (
                      <p className="mt-1 pl-6 text-[13px] text-ink-3">
                        {(day.exercises || []).length} exercises · 2 working sets each, to failure
                      </p>
                    )}
                  </div>
                  {open && (
                    <>
                      {day.exercises && day.exercises.length > 0 ? (
                        <div>
                          {day.exercises.map(ex => (
                            <ExerciseDetailButton
                              key={ex.id}
                              exerciseId={ex.exercise_id}
                              className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 active:bg-sunken"
                            >
                              <span className="text-[15px] font-medium text-ink">{ex.exercise_name}</span>
                              <span className="text-[13px] text-ink-3 tabular-nums">
                                {ex.target_sets} sets
                              </span>
                            </ExerciseDetailButton>
                          ))}
                        </div>
                      ) : (
                        <p className="px-4 py-3 text-xs text-ink-3">No exercises assigned yet</p>
                      )}
                      <div className="p-4 pt-3">
                        <Button
                          className="w-full min-h-13 text-[15px]"
                          onClick={() => startWorkout(day)}
                          disabled={starting === day.id}
                        >
                          {starting === day.id ? 'Starting...' : 'Start Workout'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Volume summary: actual vs planned */}
      {allBodyParts.length > 0 && (
        <div className="rounded-card border border-line bg-card p-4 shadow-card">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink">This week's volume</h3>
            <Link to={`/programs/${meso.id}/volume`} className="text-[13px] font-medium text-accent">
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
                  <span className="w-24 truncate text-xs capitalize text-ink-2">{bp}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: chart.series1 }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-ink-2 tabular-nums">
                    {Math.round(done * 10) / 10}
                    <span className="text-ink-4">/{Math.round(planned * 10) / 10}</span>
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-2.5 text-[10px] text-ink-3">working sets done / planned</div>
        </div>
      )}

      {/* Recent workouts: read-only history, tap through for the set log */}
      {trained.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Recent workouts</h3>
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
            {[...trained]
              .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))
              .slice(0, 8)
              .map(s => (
                <Link
                  key={s.id}
                  to={`/sessions/${s.id}`}
                  className="flex min-h-12 items-center justify-between px-4 py-3 transition-colors active:bg-sunken"
                >
                  <span className="text-sm font-medium text-ink">{s.day_label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-ink-3 tabular-nums">
                      {new Date(s.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <svg className="h-4 w-4 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

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
