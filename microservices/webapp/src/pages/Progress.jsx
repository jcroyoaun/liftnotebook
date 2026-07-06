import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { api } from '../api/client'
import { useChartTheme, formatShortDate } from '../lib/chartTheme'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import StatTile from '../components/ui/StatTile'
import { Skeleton, PageSkeleton } from '../components/ui/Skeleton'
import { getActiveSession } from '../lib/activeSession'

function E1RMTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-raised">
      <div className="font-medium text-ink">{p.date}</div>
      <div className="mt-0.5 text-ink-3">
        {p.weight} kg × {p.reps}
        {p.rir != null && ` @ RIR ${p.rir}`}
      </div>
      <div className="mt-0.5 font-semibold text-ink">e1RM {p.avg_e1rm} kg</div>
    </div>
  )
}

// Direct labels. The endpoint (current e1RM) is always the headline; short
// series (≤8 points) label every point so the chart reads without tooltips —
// Recharts tooltips don't open on tap.
function PointLabel({ x, y, index, value, count, fill, mutedFill }) {
  const isLast = index === count - 1
  if (!isLast && count > 8) return null
  return (
    <text
      x={x}
      y={y - 12}
      textAnchor={isLast ? 'end' : index === 0 ? 'start' : 'middle'}
      fontSize={isLast ? 12 : 11}
      fontWeight={isLast ? 600 : 500}
      fill={isLast ? fill : mutedFill}
    >
      {Math.round(value)}{isLast ? ' kg' : ''}
    </text>
  )
}

// week_start is a date-only fact ('2026-06-29T00:00:00Z'); new Date() on the
// full string shifts it a day for UTC-negative users. Build a local date from
// the y/m/d instead so the label reads the actual Monday.
function parseDateOnly(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function VolumeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-raised">
      <div className="font-medium text-ink">Week of {p.week}</div>
      <div className="mt-0.5 text-ink-3">{p.sets} muscle sets</div>
    </div>
  )
}

export default function Progress() {
  const [exercises, setExercises] = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [data, setData] = useState([])
  const [weekly, setWeekly] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { chart, axisTick } = useChartTheme()

  useEffect(() => {
    Promise.all([
      api.getUserExercises().then((d) => d.exercises || []),
      api
        .getActiveMesocycle()
        .then((d) =>
          d.mesocycle ? api.getWeeklyVolume(d.mesocycle.id).then((w) => w.weekly_volume || []) : [],
        )
        .catch(() => []),
    ])
      .then(([exs, weeklyVolume]) => {
        setExercises(exs)
        setWeekly(
          weeklyVolume.map((w) => ({
            week: parseDateOnly(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sets: Object.values(w.body_parts || {}).reduce((a, b) => a + b, 0),
          })),
        )
        if (exs.length > 0) loadProgress(exs[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  async function loadProgress(exerciseId) {
    setSelectedExercise(exerciseId)
    setLoadingProgress(true)
    try {
      const d = await api.getE1RMProgress(exerciseId)
      setData(
        (d.progress || []).map((p) => ({
          ...p,
          rawDate: p.date,
          date: formatShortDate(p.date),
        })),
      )
    } finally {
      setLoadingProgress(false)
    }
  }

  const stats = useMemo(() => {
    if (data.length === 0) return null
    const best = Math.round(Math.max(...data.map((p) => p.avg_e1rm)))
    const first = data[0].avg_e1rm
    const latest = Math.round(data[data.length - 1].avg_e1rm)
    const delta = Math.round((data[data.length - 1].avg_e1rm - first) * 10) / 10
    const pctRaw = first > 0 ? (delta / first) * 100 : 0
    const pct = Math.round(pctRaw)
    return { best, latest, delta, pct, pctRaw, sessions: data.length }
  }, [data])

  // Duplicate-day lookup for the history table: rows sharing a calendar date
  // get their time-of-day appended so they stay distinguishable.
  const dayCounts = useMemo(() => {
    const counts = {}
    data.forEach((p) => {
      const k = new Date(p.rawDate).toDateString()
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [data])

  function tableDate(p) {
    const d = new Date(p.rawDate)
    const opts = { month: 'short', day: 'numeric' }
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
    let label = d.toLocaleDateString('en-US', opts)
    if (dayCounts[d.toDateString()] > 1) {
      label += ` · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    }
    return label
  }

  if (loading) return <PageSkeleton />

  if (exercises.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-display mb-2 text-[22px] font-semibold text-ink">Nothing to chart yet</h2>
        <p className="mx-auto max-w-64 text-[15px] text-ink-3">
          No exercises with recorded sets yet. Log some workouts first!
        </p>
      </div>
    )
  }

  const selectedName = exercises.find((e) => e.id === selectedExercise)?.name

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[26px] font-semibold leading-tight text-ink">Progress</h1>

      {/* Exercise picker: horizontal chips */}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => loadProgress(ex.id)}
            className={`min-h-10 shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
              ex.id === selectedExercise
                ? 'bg-ink text-page'
                : 'border border-line-2 bg-card text-ink-2 active:bg-sunken'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      {loadingProgress ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        stats && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatTile label="Current e1RM" value={`${stats.latest}`} sub="kg" />
              {/* One data point is not a trend — and small dips are noise,
                  not alarms. Color only speaks at ≥5% either way. */}
              {stats.sessions < 2 ? (
                <StatTile label="This block" value={<span className="text-ink-2">—</span>} sub="first session" />
              ) : (
                <StatTile
                  label="This block"
                  value={
                    <span
                      className={
                        Math.abs(stats.pctRaw) < 5 ? 'text-ink-2' : stats.delta >= 0 ? 'text-ok' : 'text-danger'
                      }
                    >
                      {stats.delta >= 0 ? '▲' : '▼'} {Math.abs(stats.delta)}
                    </span>
                  }
                  sub={`kg (${stats.pct >= 0 ? '+' : ''}${stats.pct}%)`}
                />
              )}
              <StatTile label={stats.sessions === 1 ? 'Session' : 'Sessions'} value={stats.sessions} sub="logged" />
            </div>

            {/* e1RM trend */}
            <div className="rounded-card border border-line bg-card p-4 shadow-card">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">{selectedName}</div>
                  <div className="text-[11px] text-ink-3">Estimated 1RM per session (kg)</div>
                </div>
                <ExerciseDetailButton
                  exerciseId={selectedExercise}
                  className="min-h-8 rounded-full bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors active:bg-wash active:text-accent"
                >
                  Info
                </ExerciseDetailButton>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={axisTick}
                    axisLine={false}
                    tickLine={false}
                    domain={[(dataMin) => Math.floor(dataMin - 2.5), (dataMax) => Math.ceil(dataMax + 2.5)]}
                    allowDecimals={false}
                    tickFormatter={(v) => Math.round(v)}
                    width={52}
                  />
                  <Tooltip content={<E1RMTooltip />} cursor={{ stroke: chart.grid }} />
                  <Area
                    type="monotone"
                    dataKey="avg_e1rm"
                    stroke="none"
                    fill={chart.series1}
                    fillOpacity={0.1}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_e1rm"
                    stroke={chart.series1}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={{ r: 4, fill: chart.series1, stroke: chart.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, stroke: chart.surface, strokeWidth: 2 }}
                  >
                    <LabelList
                      dataKey="avg_e1rm"
                      content={(props) => (
                        <PointLabel {...props} count={data.length} fill={chart.ink} mutedFill={chart.axisText} />
                      )}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* History table (relief view) */}
            <div className="rounded-card border border-line bg-card shadow-card">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink transition-colors active:bg-sunken"
              >
                Session history
                <span className="text-ink-3">{showHistory ? '▾' : '▸'}</span>
              </button>
              {showHistory && (
                <div className="px-4 pb-4 text-xs">
                  <div className="flex items-center gap-2 border-b border-line pb-1 font-medium text-ink-3">
                    <div className="grid flex-1 grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1fr] gap-2">
                      <div>Date</div>
                      <div>Weight</div>
                      <div>Reps</div>
                      <div>RIR</div>
                      <div>e1RM</div>
                    </div>
                    <div className="w-3.5 shrink-0" />
                  </div>
                  {[...data].reverse().map((p, i) => {
                    const cells = (
                      <div className="grid flex-1 grid-cols-[1.5fr_1fr_0.6fr_0.6fr_1fr] gap-2">
                        <div>{tableDate(p)}</div>
                        <div>{p.weight} kg</div>
                        <div>{p.reps}</div>
                        <div>{p.rir ?? '–'}</div>
                        <div className="font-semibold text-ink">{p.avg_e1rm}</div>
                      </div>
                    )
                    // Each row opens the workout it came from (when the point
                    // carries its session id) — straight into the logger,
                    // the one view of a workout.
                    return p.session_id ? (
                      <Link
                        key={i}
                        to={`/workout/${p.session_id}`}
                        state={
                          String(getActiveSession()?.id) === String(p.session_id)
                            ? undefined
                            : { edit: true }
                        }
                        className="flex min-h-11 items-center gap-2 border-b border-line/50 py-1.5 text-ink-2 tabular-nums transition-colors hover:bg-sunken active:bg-sunken"
                      >
                        {cells}
                        <svg className="h-3.5 w-3.5 shrink-0 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ) : (
                      <div key={i} className="flex items-center gap-2 border-b border-line/50 py-1.5 text-ink-2 tabular-nums">
                        {cells}
                        <div className="w-3.5 shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Weekly volume across the block */}
      {weekly.length > 0 && (
        <div className="rounded-card border border-line bg-card p-4 shadow-card">
          <div className="text-sm font-semibold text-ink">Weekly volume</div>
          <div className="mb-1 text-[11px] text-ink-3">Muscle sets per week — each set counts once per muscle it works</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekly} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={52} />
              <Tooltip content={<VolumeTooltip />} cursor={{ fill: chart.grid, fillOpacity: 0.35 }} />
              <Bar dataKey="sets" fill={chart.series1} radius={[4, 4, 0, 0]} maxBarSize={24}>
                <LabelList dataKey="sets" position="top" style={{ fontSize: 11, fill: chart.axisText }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
