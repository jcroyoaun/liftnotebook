import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getUser } from '../auth/session'
import { getWeekVolume } from './dashboardVolume'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import StatTile from '../components/ui/StatTile'
import Button from '../components/ui/Button'
import BottomSheet from '../components/ui/BottomSheet'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { PageSkeleton } from '../components/ui/Skeleton'
import { getActiveSession, ACTIVE_SESSION_KEY } from '../lib/activeSession'
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
  // Day whose Start tap is parked behind the "workout in progress" sheet.
  const [pendingStart, setPendingStart] = useState(null)
  const [discarding, setDiscarding] = useState(false)
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
        loadVolume(data.mesocycle, data.days)
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

  async function loadVolume(mesoData, daysList) {
    const mesoId = mesoData.id
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
      // The lifter's CURRENT user-defined week — a fresh week correctly
      // shows zeros, it never falls back to last week's bars.
      setActualVolume(getWeekVolume(data.weekly_volume || [], mesoData.current_week ?? 1))
    } catch (err) {
      console.error('Actual volume error:', err)
    }
  }

  // One view per workout (owner's law): "Edit plan" opens the day's workout
  // view — an edit-mode session created on demand. Nothing logged = the husk
  // is deleted on exit; structural changes flow through the save prompt.
  async function editPlanInLogger(day) {
    setStarting(day.id)
    try {
      const currentWeek = meso.current_week ?? 1
      const existing = sessions.find(
        s => s.training_day_id === day.id && (s.week_number ?? 1) === currentWeek
      )
      let sid = existing?.id
      if (!sid) {
        const data = await api.createSession({ mesocycle_id: meso.id, training_day_id: day.id })
        sid = data.session.id
      }
      navigate(`/workout/${sid}`, { state: { edit: true } })
    } catch (err) {
      toast(err.message)
    } finally {
      setStarting(null)
    }
  }

  // The week ends when the lifter says so — this is the only way a new week
  // starts. Partial weeks are fine; nothing is ever forced by the calendar.
  async function advanceWeek() {
    try {
      const data = await api.advanceWeek(meso.id)
      setConfirmAction(null)
      toast(`Week ${data.current_week} — fresh page`, 'success')
      await loadActive()
    } catch (err) {
      toast(err.message)
    }
  }

  function startWorkout(day) {
    // Mid-workout guard: starting always creates a NEW session, so an
    // existing activeSession means the lifter is about to stack a second
    // workout on top of an unfinished one — make that an explicit choice.
    if (getActiveSession()?.id) {
      setPendingStart(day)
      return
    }
    launchWorkout(day)
  }

  async function launchWorkout(day) {
    setStarting(day.id)
    try {
      const data = await api.createSession({
        mesocycle_id: meso.id,
        training_day_id: day.id,
      })
      // Mark it active BEFORE navigating: the logger infers edit-vs-live
      // from this marker, and its own (post-data) write can lose the race
      // against a fast first fetch that already contains recorded sets.
      localStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify({ id: String(data.session.id), label: day.label })
      )
      navigate(`/workout/${data.session.id}`)
    } catch (err) {
      toast(err.message)
    } finally {
      setStarting(null)
    }
  }

  function resumeActive() {
    const active = getActiveSession()
    setPendingStart(null)
    if (active?.id) navigate(`/workout/${active.id}`)
  }

  async function discardAndStartNew() {
    const day = pendingStart
    const active = getActiveSession()
    setDiscarding(true)
    try {
      if (active?.id) {
        try {
          const d = await api.getSession(active.id)
          const recorded = (d.sets || []).filter((s) => s.recorded).length
          // Empty shells get deleted; anything with logged work stays in the
          // books — we only abandon it.
          if (recorded === 0) await api.deleteSession(active.id)
        } catch (err) {
          console.error('Discard check failed:', err)
        }
      }
      localStorage.removeItem(ACTIVE_SESSION_KEY)
      setPendingStart(null)
      await launchWorkout(day)
    } finally {
      setDiscarding(false)
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

  // Week stats. Training weeks are USER-DEFINED (owner's law): a week ends
  // when the lifter taps "Start next week", never on a calendar boundary.
  // Nobody is forced to start on Monday or to complete every day before
  // moving on. NEVER reintroduce Date-based week math here.
  const currentWeek = meso.current_week ?? 1
  const weekSessions = trained.filter(s => (s.week_number ?? 1) === currentWeek)
  // Actual sets logged this week — not per-muscle volume credit (a set that
  // works two muscles still counts once here; the volume table below keeps
  // the credited framing).
  const setsThisWeek = weekSessions.reduce((sum, s) => sum + (s.recorded_sets || 0), 0)
  // Distinct training days completed this week — repeats and partials don't
  // inflate the count past the split.
  const doneDayIds = new Set(weekSessions.map(s => s.training_day_id))
  const workoutsThisWeek = doneDayIds.size

  // Consistency streak: consecutive user-weeks with at least one workout,
  // counting back from the current week. A quiet current week doesn't break
  // the streak until it's over — last week's streak carries through.
  const weeksWithSessions = new Set(trained.map(s => s.week_number ?? 1))
  let streakWeeks = 0
  for (
    let w = weeksWithSessions.has(currentWeek) ? currentWeek : currentWeek - 1;
    w >= 1 && weeksWithSessions.has(w);
    w--
  ) streakWeeks++

  const allDaysDone = days.length > 0 && days.every(d => doneDayIds.has(d.id))

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
  const cyclicNext = sortedDays.length
    ? sortedDays.find(d => d.day_number === (lastDayNumber % sortedDays.length) + 1) || sortedDays[0]
    : null
  // Up next = first day in program order not yet done this week. Once every
  // day is done, fall back to the cyclic pick for the default expansion —
  // but the badge itself never sits on a ✓ Done card.
  const nextDay = sortedDays.find(d => !doneDayIds.has(d.id)) || cyclicNext

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
        <p className="mt-0.5 text-sm text-ink-3">Week {currentWeek} · {meso.days_per_week} days/week</p>
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent-solid transition-all duration-500"
              style={{ width: `${Math.min(100, (workoutsThisWeek / meso.days_per_week) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 text-right text-[11px] text-ink-3 tabular-nums">
            {workoutsThisWeek} of {meso.days_per_week} {meso.days_per_week === 1 ? 'workout' : 'workouts'} this week
          </div>
        </div>
      </div>

      {/* Week at a glance */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="workouts" value={`${workoutsThisWeek}/${meso.days_per_week}`} sub="this week" />
        <StatTile label={setsThisWeek === 1 ? 'set' : 'sets'} value={setsThisWeek} sub="this week" />
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
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">This block</h3>
            {/* The week ends when the lifter says so — always reachable,
                even mid-week with days left undone. */}
            {workoutsThisWeek > 0 && !allDaysDone && (
              <button
                onClick={() => setConfirmAction('advance')}
                className="min-h-8 text-[13px] font-medium text-accent"
              >
                Start next week →
              </button>
            )}
          </div>
          {allDaysDone && (
            <Button className="mb-2.5 w-full min-h-12" onClick={() => setConfirmAction('advance')}>
              Week {currentWeek} done — start week {currentWeek + 1} →
            </Button>
          )}
          <div className="space-y-2.5">
            {sortedDays.map(day => {
              const isDone = doneDayIds.has(day.id)
              const isSuggested = day.id === nextDay?.id
              // A ✓ Done card never wears the Up next badge, even in the
              // all-days-done fallback (the suggestion still opens the card).
              const isNext = isSuggested && !isDone
              const open = dayOverrides[day.id] ?? isSuggested
              // Done days link back to this week's latest workout for the day.
              const daySession = isDone
                ? weekSessions
                    .filter(s => s.training_day_id === day.id)
                    .reduce((latest, s) =>
                      !latest || new Date(s.performed_at) > new Date(latest.performed_at) ? s : latest,
                    null)
                : null
              // A workout in progress owns its day card: every action leads
              // back into the logger — navigating away and returning must
              // never route through "Start" or the plan editor.
              const active = getActiveSession()
              const activeForDay = active?.id && active.label === day.label ? active : null
              const doneChip = activeForDay ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-wash px-2 py-0.5 text-[11px] font-medium text-accent">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-solid" aria-hidden="true" />
                  In progress
                </span>
              ) : (
                isDone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-wash px-2 py-0.5 text-[11px] font-medium text-ok">
                    ✓ Done
                  </span>
                )
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
                        {/* One view per workout: Edit plan ALSO opens the
                            logger (an edit-mode session for the day, created
                            on demand). The template editor page exists only
                            inside block creation. Done/running days already
                            route through their workout. */}
                        {!activeForDay && !isDone && (
                          <button
                            onClick={() => editPlanInLogger(day)}
                            disabled={starting === day.id}
                            className="min-h-8 rounded-btn px-2 py-1 text-xs font-medium text-ink-3 transition-colors hover:bg-sunken hover:text-ink-2 disabled:opacity-50"
                          >
                            Edit plan
                          </button>
                        )}
                        {!open && (
                          activeForDay ? (
                            <button
                              onClick={() => navigate(`/workout/${activeForDay.id}`)}
                              className="min-h-8 rounded-btn bg-accent-solid px-3 py-1 text-xs font-semibold text-on-accent transition-all active:scale-[0.97]"
                            >
                              Continue
                            </button>
                          ) : (
                            <button
                              onClick={() => startWorkout(day)}
                              disabled={starting === day.id}
                              className="min-h-8 rounded-btn border border-line-2 bg-card px-3 py-1 text-xs font-semibold text-ink transition-all hover:bg-sunken active:scale-[0.97] disabled:opacity-50"
                            >
                              {starting === day.id ? 'Starting...' : isDone ? 'Start again' : 'Start Workout'}
                            </button>
                          )
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
                              <span className="ml-1 text-ink-4">×{ex.target_sets}</span>
                            </ExerciseDetailButton>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-ink-3">No exercises assigned yet</p>
                      )
                    )}
                    {open && (
                      <p className="mt-1 pl-6 text-[13px] text-ink-3">
                        {/* No hardcoded set count — "All future workouts" can
                            grow a slot's target beyond the house default. */}
                        {(day.exercises || []).length} {(day.exercises || []).length === 1 ? 'exercise' : 'exercises'} · working sets to failure
                      </p>
                    )}
                  </div>
                  {open && (
                    <>
                      {activeForDay ? (
                        // Mid-workout: live progress so far — coming back
                        // after wandering off shows exactly where you left it.
                        <DoneDayResults sessionId={activeForDay.id} />
                      ) : isDone && daySession ? (
                        // Done days show the receipts, not the plan — what was
                        // actually lifted, per set, right on the card.
                        <DoneDayResults sessionId={daySession.id} />
                      ) : day.exercises && day.exercises.length > 0 ? (
                        <div>
                          {day.exercises.map(ex => (
                            <ExerciseDetailButton
                              key={ex.id}
                              exerciseId={ex.exercise_id}
                              className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 active:bg-sunken"
                            >
                              <span className="text-[15px] font-medium text-ink">{ex.exercise_name}</span>
                              <span className="text-[13px] text-ink-3 tabular-nums">
                                {ex.target_sets} {ex.target_sets === 1 ? 'set' : 'sets'}
                              </span>
                            </ExerciseDetailButton>
                          ))}
                        </div>
                      ) : (
                        <p className="px-4 py-3 text-xs text-ink-3">No exercises assigned yet</p>
                      )}
                      <div className="p-4 pt-3">
                        {activeForDay ? (
                          <Button
                            className="w-full min-h-13 text-[15px]"
                            onClick={() => navigate(`/workout/${activeForDay.id}`)}
                          >
                            Continue workout →
                          </Button>
                        ) : (
                          <>
                            {isDone && daySession && (
                              <Link
                                to={`/workout/${daySession.id}`}
                                state={{ edit: true }}
                                className="mb-2 flex min-h-11 w-full items-center justify-center rounded-btn text-sm font-semibold text-accent transition-colors active:bg-wash"
                              >
                                View workout →
                              </Link>
                            )}
                            <Button
                              variant={isDone ? 'secondary' : 'primary'}
                              className="w-full min-h-13 text-[15px]"
                              onClick={() => startWorkout(day)}
                              disabled={starting === day.id}
                            >
                              {starting === day.id ? 'Starting...' : isDone ? 'Start again' : 'Start Workout'}
                            </Button>
                          </>
                        )}
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

      {/* Recent workouts: tap through into the workout view (the logger) */}
      {trained.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Recent workouts</h3>
            <Link to="/history" className="text-[13px] font-medium text-accent">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
            {[...trained]
              .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))
              .slice(0, 8)
              .map(s => (
                <Link
                  key={s.id}
                  to={`/workout/${s.id}`}
                  state={
                    String(getActiveSession()?.id) === String(s.id)
                      ? undefined
                      : { edit: true }
                  }
                  className="flex min-h-12 items-center justify-between px-4 py-3 transition-colors active:bg-sunken"
                >
                  <span className="text-sm font-medium text-ink">{s.day_label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-ink-3 tabular-nums">
                      {new Date(s.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(s.performed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' · '}
                      {s.recorded_sets ?? 0} {(s.recorded_sets ?? 0) === 1 ? 'set' : 'sets'}
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

      {/* Two real choices (Resume / Discard), so this is a BottomSheet rather
          than the single-action ConfirmSheet. */}
      <BottomSheet open={!!pendingStart} onClose={() => setPendingStart(null)} title="Workout in progress">
        <p className="mb-4 text-sm text-ink-2">
          You're mid-workout. Resume it, or discard and start fresh?
        </p>
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={resumeActive}>
            Resume
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={discardAndStartNew}
            disabled={discarding}
          >
            {discarding ? 'Starting...' : 'Discard & start new'}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirmAction === 'advance'}
        title={`Start week ${(meso.current_week ?? 1) + 1}?`}
        body="Your week ends when you say so — done days reset for the new week, and everything you logged stays in the books."
        confirmLabel="Start next week"
        onConfirm={advanceWeek}
        onClose={() => setConfirmAction(null)}
      />
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

// The results block inside a ✓ Done day card: every recorded set of that
// day's workout, grouped per exercise in logged order, with the exercise's
// note when one was left. The plan already happened — show what did.
function DoneDayResults({ sessionId }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api.getSession(sessionId)
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sessionId])

  if (failed) return <p className="px-4 py-3 text-xs text-ink-3">Couldn't load this workout.</p>
  if (!data) {
    return (
      <div className="space-y-2 px-4 py-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-sunken" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
      </div>
    )
  }

  const fmtW = (v) => String(parseFloat(Number(v).toFixed(2)))
  const fmtSet = (s) =>
    s.weight_left != null && s.weight_right != null
      ? `R${fmtW(s.weight_right)}/L${fmtW(s.weight_left)}×${s.reps}`
      : `${fmtW(s.weight)}×${s.reps}`

  const noteByExercise = new Map(
    (data.exercise_notes || []).filter((n) => n.note).map((n) => [n.exercise_id, n.note])
  )
  const byExercise = new Map()
  for (const s of data.sets || []) {
    if (!s.recorded) continue
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { exerciseId: s.exercise_id, name: s.exercise_name, sets: [], firstId: s.id ?? 0 })
    }
    const g = byExercise.get(s.exercise_id)
    g.sets.push(s)
    g.firstId = Math.min(g.firstId, s.id ?? g.firstId)
  }
  const groups = [...byExercise.values()].sort((a, b) => a.firstId - b.firstId)
  for (const g of groups) g.sets.sort((a, b) => a.set_number - b.set_number)

  if (groups.length === 0) {
    return <p className="px-4 py-3 text-xs text-ink-3">Nothing recorded in this workout.</p>
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.exerciseId} className="border-b border-line px-4 py-3 last:border-b-0">
          <div className="flex items-baseline justify-between gap-2">
            <ExerciseDetailButton
              exerciseId={g.exerciseId}
              className="min-w-0 text-left text-[15px] font-medium text-ink transition-colors hover:text-accent"
            >
              {g.name}
            </ExerciseDetailButton>
            <span className="shrink-0 text-[13px] text-ink-2 tabular-nums">
              {g.sets.map(fmtSet).join(' · ')} kg
            </span>
          </div>
          {noteByExercise.has(g.exerciseId) && (
            <p className="mt-1 text-[12px] leading-snug text-ink-3">
              <span aria-hidden="true">📝</span> {noteByExercise.get(g.exerciseId)}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
