import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'

export default function Progress() {
  const [exercises, setExercises] = useState([])
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getUserExercises()
      .then(d => setExercises(d.exercises || []))
      .finally(() => setLoading(false))
  }, [])

  async function loadProgress(exerciseId) {
    setSelectedExercise(exerciseId)
    setLoadingProgress(true)
    try {
      const d = await api.getE1RMProgress(exerciseId)
      setData((d.progress || []).map(p => ({
        ...p,
        date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      })))
    } finally {
      setLoadingProgress(false)
    }
  }

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
  const selectedName = exercises.find(e => e.id === selectedExercise)?.name

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Progress (Estimated 1RM)</h2>

      {exercises.length === 0 && !selectedExercise ? (
        <div className="text-center py-8 text-slate-400">
          No exercises with recorded sets yet. Log some workouts first!
        </div>
      ) : (
        <>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your exercises..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          {!selectedExercise && (
            <div className="grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
              {filtered.map(ex => (
                <div key={ex.id} className="flex gap-2">
                  <button onClick={() => loadProgress(ex.id)}
                    className="flex-1 text-left px-3 py-2 text-sm bg-white rounded-lg border border-slate-200 hover:bg-blue-50">
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{ex.movement_pattern}</span>
                  </button>
                  <ExerciseDetailButton
                    exerciseId={ex.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  >
                    Targets
                  </ExerciseDetailButton>
                </div>
              ))}
            </div>
          )}

          {selectedExercise && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{selectedName}</h3>
                  <ExerciseDetailButton
                    exerciseId={selectedExercise}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Targets
                  </ExerciseDetailButton>
                </div>
                <button onClick={() => { setSelectedExercise(null); setData([]) }}
                  className="text-xs text-slate-500 hover:text-slate-700">Change exercise</button>
              </div>

              {loadingProgress ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              ) : data.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No data yet. Log some workouts first!</div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        formatter={(value, name) => [`${value} lbs`, name === 'avg_e1rm' ? 'Avg e1RM' : name]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="avg_e1rm" name="Avg e1RM" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="epley_e1rm" name="Epley" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="brzycki_e1rm" name="Brzycki" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Data table */}
                  <div className="mt-4 text-xs">
                    <div className="grid grid-cols-5 gap-2 font-medium text-slate-500 border-b pb-1">
                      <div>Date</div><div>Weight</div><div>Reps</div><div>RIR</div><div>e1RM</div>
                    </div>
                    {data.map((p, i) => (
                      <div key={i} className="grid grid-cols-5 gap-2 py-1 border-b border-slate-50">
                        <div>{p.date}</div>
                        <div>{p.weight}</div>
                        <div>{p.reps}</div>
                        <div>{p.rir ?? '-'}</div>
                        <div className="font-medium">{p.avg_e1rm}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
