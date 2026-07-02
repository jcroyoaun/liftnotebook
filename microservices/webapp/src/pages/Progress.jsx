import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { api } from '../api/client'
import { chart, axisTick, formatShortDate } from '../lib/chartTheme'
import ExerciseDetailButton from '../components/ExerciseDetailButton'
import StatTile from '../components/ui/StatTile'
import { PageSkeleton } from '../components/ui/Skeleton'

function E1RMTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <div className="font-medium text-slate-800">{p.date}</div>
      <div className="text-slate-500 mt-0.5">
        {p.weight} kg × {p.reps}
        {p.rir != null && ` @ RIR ${p.rir}`}
      </div>
      <div className="text-slate-800 font-semibold mt-0.5">e1RM {p.avg_e1rm} kg</div>
    </div>
  )
}

// Direct label on the endpoint only — the current e1RM is the headline.
function LastPointLabel({ x, y, index, value, count }) {
  if (index !== count - 1) return null
  return (
    <text x={x} y={y - 12} textAnchor="end" fontSize={12} fontWeight={600} fill="#0f172a">
      {Math.round(value)} kg
    </text>
  )
}

function VolumeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <div className="font-medium text-slate-800">Week of {p.week}</div>
      <div className="text-slate-500 mt-0.5">{p.sets} working sets</div>
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
            week: formatShortDate(w.week_start),
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
    const pct = first > 0 ? Math.round((delta / first) * 100) : 0
    return { best, latest, delta, pct, sessions: data.length }
  }, [data])

  if (loading) return <PageSkeleton />

  if (exercises.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        No exercises with recorded sets yet. Log some workouts first!
      </div>
    )
  }

  const selectedName = exercises.find((e) => e.id === selectedExercise)?.name

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Progress</h1>

      {/* Exercise picker: horizontal chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => loadProgress(ex.id)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-colors ${
              ex.id === selectedExercise
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 active:bg-slate-50'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      {loadingProgress ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        stats && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Current e1RM" value={`${stats.latest}`} sub="kg" />
              <StatTile
                label="This block"
                value={
                  <span className={stats.delta >= 0 ? 'text-green-700' : 'text-red-600'}>
                    {stats.delta >= 0 ? '▲' : '▼'} {Math.abs(stats.delta)}
                  </span>
                }
                sub={`kg (${stats.pct >= 0 ? '+' : ''}${stats.pct}%)`}
              />
              <StatTile label="Sessions" value={stats.sessions} sub="logged" />
            </div>

            {/* e1RM trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{selectedName}</div>
                  <div className="text-[11px] text-slate-400">Estimated 1RM per session (kg)</div>
                </div>
                <ExerciseDetailButton
                  exerciseId={selectedExercise}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
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
                    domain={['auto', 'auto']}
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
                      content={(props) => <LastPointLabel {...props} count={data.length} />}
                    />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* History table (relief view) */}
            <div className="bg-white rounded-xl border border-slate-200">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700"
              >
                Session history
                <span className="text-slate-400">{showHistory ? '▾' : '▸'}</span>
              </button>
              {showHistory && (
                <div className="px-4 pb-4 text-xs">
                  <div className="grid grid-cols-5 gap-2 font-medium text-slate-500 border-b border-slate-100 pb-1">
                    <div>Date</div>
                    <div>Weight</div>
                    <div>Reps</div>
                    <div>RIR</div>
                    <div>e1RM</div>
                  </div>
                  {[...data].reverse().map((p, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 py-1.5 border-b border-slate-50 text-slate-600">
                      <div>{p.date}</div>
                      <div>{p.weight} kg</div>
                      <div>{p.reps}</div>
                      <div>{p.rir ?? '–'}</div>
                      <div className="font-semibold text-slate-800">{p.avg_e1rm}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Weekly volume across the block */}
      {weekly.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-800">Weekly volume</div>
          <div className="text-[11px] text-slate-400 mb-1">Working sets per week, current block</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekly} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={chart.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={52} />
              <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(226,232,240,0.4)' }} />
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
