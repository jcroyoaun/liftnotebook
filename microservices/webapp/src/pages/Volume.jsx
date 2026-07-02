import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { api } from '../api/client'
import { chart, axisTick } from '../lib/chartTheme'
import PageHeader from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'

function VolumeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <div className="font-medium text-slate-800">{p.name}</div>
      <div className="text-slate-500 mt-0.5">{p.sets} working sets</div>
    </div>
  )
}

export default function Volume() {
  const { id: mesoId } = useParams()
  const [volume, setVolume] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMesocycleVolume(mesoId)
      .then(d => setVolume(d.volume || []))
      .finally(() => setLoading(false))
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

  const chartData = volume.map(bp => ({
    name: bp.body_part.charAt(0).toUpperCase() + bp.body_part.slice(1),
    sets: Math.round(bp.total_sets * 10) / 10,
  }))

  return (
    <div className="space-y-4">
      <PageHeader title="Block volume" subtitle="Total working sets per muscle group" backTo="/programs/history" />

      {volume.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500 mb-1 font-medium">No workout data yet</p>
          <p className="text-sm text-slate-400">Log a session and volume shows up here.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke={chart.grid} strokeWidth={1} horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={axisTick} axisLine={false} tickLine={false} width={86} />
                <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(226,232,240,0.4)' }} />
                <Bar dataKey="sets" fill={chart.series1} radius={[0, 4, 4, 0]} maxBarSize={16}>
                  <LabelList dataKey="sets" position="right" style={{ fontSize: 11, fill: chart.axisText }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {volume.map(bp => (
              <div key={bp.body_part}>
                <button
                  onClick={() => setExpanded(expanded === bp.body_part ? null : bp.body_part)}
                  className="w-full px-4 py-3 flex items-center justify-between">
                  <span className="font-medium text-sm text-slate-800 capitalize">{bp.body_part}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 tabular-nums">{Math.round(bp.total_sets * 10) / 10} sets</span>
                    <svg className={`h-4 w-4 text-slate-300 transition-transform ${expanded === bp.body_part ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {expanded === bp.body_part && bp.sub_muscles && (
                  <div className="px-4 pb-3 space-y-1">
                    {bp.sub_muscles.map(m => (
                      <div key={m.muscle_id} className="flex justify-between py-0.5">
                        <span className="text-sm text-slate-500">{m.muscle_name}</span>
                        <span className="text-sm text-slate-700 tabular-nums">{Math.round(m.sets * 10) / 10}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
