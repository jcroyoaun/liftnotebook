import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { api } from '../api/client'
import { useChartTheme } from '../lib/chartTheme'
import PageHeader from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'

function VolumeTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-raised">
      <div className="font-medium text-ink">{p.name}</div>
      <div className="mt-0.5 text-ink-3">{p.sets} working sets{unit ? ` ${unit}` : ''}</div>
    </div>
  )
}

// One body-part volume block: horizontal bar chart + expandable muscle list.
// Rendered twice on this page (planned and performed), so state lives here.
function VolumePanel({ volume, unit }) {
  const [expanded, setExpanded] = useState(null)
  const { chart, axisTick } = useChartTheme()

  const chartData = volume.map(bp => ({
    name: bp.body_part.charAt(0).toUpperCase() + bp.body_part.slice(1),
    sets: Math.round(bp.total_sets * 10) / 10,
  }))

  return (
    <>
      <div className="rounded-card border border-line bg-card p-4 shadow-card">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={chart.grid} strokeWidth={1} horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={axisTick} axisLine={false} tickLine={false} width={86} />
            <Tooltip content={<VolumeTooltip unit={unit} />} cursor={{ fill: chart.grid, fillOpacity: 0.35 }} />
            <Bar dataKey="sets" fill={chart.series1} radius={[0, 4, 4, 0]} maxBarSize={16}>
              <LabelList dataKey="sets" position="right" style={{ fontSize: 11, fill: chart.axisText }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="divide-y divide-line rounded-card border border-line bg-card shadow-card">
        {volume.map(bp => (
          <div key={bp.body_part}>
            <button
              onClick={() => setExpanded(expanded === bp.body_part ? null : bp.body_part)}
              className="flex min-h-12 w-full items-center justify-between px-4 py-3 transition-colors active:bg-sunken">
              <span className="text-sm font-medium capitalize text-ink">{bp.body_part}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-2 tabular-nums">{Math.round(bp.total_sets * 10) / 10} sets</span>
                <svg className={`h-4 w-4 text-ink-4 transition-transform ${expanded === bp.body_part ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {expanded === bp.body_part && bp.sub_muscles && (
              <div className="space-y-1 px-4 pb-3">
                {bp.sub_muscles.map(m => (
                  <div key={m.muscle_id} className="flex justify-between py-0.5">
                    <span className="text-sm text-ink-3">{m.muscle_name}</span>
                    <span className="text-sm text-ink-2 tabular-nums">{Math.round(m.sets * 10) / 10}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export default function Volume() {
  const { id: mesoId } = useParams()
  const [volume, setVolume] = useState([])
  const [planned, setPlanned] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Performed and planned load independently so one failure doesn't kill both.
    const performed = api.getMesocycleVolume(mesoId)
      .then(d => setVolume(d.volume || []))
      .catch(err => console.error('Volume error:', err))
    const plan = api.getMesocycle(mesoId)
      .then(d => {
        const exercises = (d.days || []).flatMap(day =>
          (day.exercises || []).map(e => ({ exercise_id: e.exercise_id, sets: e.target_sets }))
        )
        if (exercises.length === 0) return setPlanned([])
        return api.previewVolume({ exercises }).then(p => setPlanned(p.volume || []))
      })
      .catch(err => console.error('Planned volume error:', err))
    Promise.allSettled([performed, plan]).then(() => setLoading(false))
  }, [mesoId])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-64" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Block volume" subtitle="Working sets per muscle group" backTo="/programs/history" />

      {/* Planned: pure program math (target sets × muscle map), no logging
          required — this is the planning view */}
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Planned · per week</h3>
          <span className="text-[11px] text-ink-3">from your program</span>
        </div>
        <div className="mt-2 space-y-4">
          {planned.length === 0 ? (
            <div className="rounded-card border border-line bg-card px-4 py-8 text-center shadow-card">
              <p className="mb-1 font-medium text-ink-2">Nothing planned yet</p>
              <p className="text-sm text-ink-3">Add exercises to your training days and the weekly plan shows up here.</p>
            </div>
          ) : (
            <VolumePanel volume={planned} unit="planned / week" />
          )}
        </div>
      </div>

      {/* Performed: recorded sets only, whole block */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-2">Performed · this block</h3>
        <div className="mt-2 space-y-4">
          {volume.length === 0 ? (
            <div className="rounded-card border border-line bg-card px-4 py-8 text-center shadow-card">
              <p className="mb-1 font-medium text-ink-2">No workout data yet</p>
              <p className="text-sm text-ink-3">Log a session and volume shows up here.</p>
            </div>
          ) : (
            <VolumePanel volume={volume} unit="this block" />
          )}
        </div>
      </div>
    </div>
  )
}
