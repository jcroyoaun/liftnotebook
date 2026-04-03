import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'

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

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  const chartData = volume.map(bp => ({
    name: bp.body_part.charAt(0).toUpperCase() + bp.body_part.slice(1),
    sets: Math.round(bp.total_sets * 10) / 10,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Volume per Muscle Group</h2>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">Back</Link>
      </div>

      {volume.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No workout data yet.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={v => [`${v} sets`]} />
                <Bar dataKey="sets" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {volume.map(bp => (
              <div key={bp.body_part} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === bp.body_part ? null : bp.body_part)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-sm text-slate-800 capitalize">{bp.body_part}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-600">{Math.round(bp.total_sets * 10) / 10} sets</span>
                    <span className="text-xs text-slate-400">{expanded === bp.body_part ? '-' : '+'}</span>
                  </div>
                </button>

                {expanded === bp.body_part && bp.sub_muscles && (
                  <div className="border-t border-slate-100 px-4 py-2 space-y-1">
                    {bp.sub_muscles.map(m => (
                      <div key={m.muscle_id} className="flex justify-between py-1">
                        <span className="text-sm text-slate-600">{m.muscle_name}</span>
                        <span className="text-sm font-mono text-slate-800">{Math.round(m.sets * 10) / 10} sets</span>
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
