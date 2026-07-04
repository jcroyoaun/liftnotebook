import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { api } from '../api/client'
import { useChartTheme } from '../lib/chartTheme'
import PageHeader from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'

const round1 = (n) => Math.round(n * 10) / 10

function splitLine(primary, secondary) {
  if (!secondary) return `${round1(primary)} primary`
  if (!primary) return `${round1(secondary)} secondary ×½`
  return `${round1(primary)} primary + ${round1(secondary)} secondary ×½`
}

function VolumeTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-raised">
      <div className="font-medium text-ink">{p.name}</div>
      <div className="mt-0.5 tabular-nums text-ink-2">{p.sets} working sets{unit ? ` ${unit}` : ''}</div>
      <div className="mt-0.5 tabular-nums text-ink-3">{splitLine(p.primaryRaw, p.secondaryRaw)}</div>
    </div>
  )
}

// One body-part volume block: stacked horizontal bars — primary work and
// ½-credited secondary work as two steps of the same hue, so bar length IS
// the merged total — plus an expandable per-muscle rundown.
// Rendered twice on this page (planned and performed), so state lives here.
function VolumePanel({ volume, unit }) {
  const [expanded, setExpanded] = useState(null)
  const { chart, axisTick } = useChartTheme()

  const chartData = volume.map(bp => ({
    name: bp.body_part.charAt(0).toUpperCase() + bp.body_part.slice(1),
    primary: round1(bp.primary_sets || 0),
    secondaryCredit: round1((bp.secondary_sets || 0) * 0.5),
    primaryRaw: bp.primary_sets || 0,
    secondaryRaw: bp.secondary_sets || 0,
    sets: round1(bp.total_sets),
  }))
  const hasSecondary = chartData.some(d => d.secondaryCredit > 0)

  return (
    <>
      <div className="rounded-card border border-line bg-card p-4 shadow-card">
        {hasSecondary && (
          <div className="mb-2 flex items-center gap-4 text-[11px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: chart.series1 }} />
              Primary
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: chart.series1Soft }} />
              Secondary ×½
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={chart.grid} strokeWidth={1} horizontal={false} />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={axisTick} axisLine={false} tickLine={false} width={86} />
            <Tooltip content={<VolumeTooltip unit={unit} />} cursor={{ fill: chart.grid, fillOpacity: 0.35 }} />
            <Bar dataKey="primary" stackId="v" fill={chart.series1} stroke={chart.surface} strokeWidth={1} maxBarSize={16} />
            {/* minPointSize keeps a hairline closing segment on zero-secondary
                rows so every row's merged total gets its direct label. */}
            <Bar dataKey="secondaryCredit" stackId="v" fill={chart.series1Soft} stroke={chart.surface} strokeWidth={1} radius={[0, 4, 4, 0]} maxBarSize={16} minPointSize={2}>
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
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 transition-colors active:bg-sunken">
              <span className="text-sm font-medium capitalize text-ink">{bp.body_part}</span>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm text-ink-2 tabular-nums">{round1(bp.total_sets)} sets</div>
                  <div className="text-[11px] text-ink-3 tabular-nums">{splitLine(bp.primary_sets, bp.secondary_sets)}</div>
                </div>
                <svg className={`h-4 w-4 text-ink-4 transition-transform ${expanded === bp.body_part ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {expanded === bp.body_part && bp.sub_muscles && (
              <div className="space-y-1.5 px-4 pb-3">
                {bp.sub_muscles.map(m => (
                  <div key={m.muscle_id} className="flex items-baseline justify-between gap-3 py-0.5">
                    <span className="min-w-0 truncate text-sm text-ink-3">{m.muscle_name}</span>
                    <div className="shrink-0 text-right">
                      <span className="text-sm text-ink-2 tabular-nums">{round1(m.sets)}</span>
                      <span className="ml-2 text-[11px] text-ink-3 tabular-nums">{splitLine(m.primary_sets, m.secondary_sets)}</span>
                    </div>
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
      <PageHeader
        title="Block volume"
        subtitle="Working sets per muscle group · secondary work counts ½"
        backTo="/programs/history"
      />

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
