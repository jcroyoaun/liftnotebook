import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function MesocycleHistory() {
  const [mesocycles, setMesocycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    api.getMesocycles()
      .then(d => setMesocycles(d.mesocycles || []))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(e, id, name) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete "${name}"? This will permanently remove all workout data for this mesocycle.`)) return
    setDeleting(id)
    try {
      await api.deleteMesocycle(id)
      setMesocycles(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      alert(err.message)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Mesocycle History</h2>
        <Link to="/mesocycle/new"
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
          New
        </Link>
      </div>

      {mesocycles.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No mesocycles yet.</div>
      ) : (
        <div className="space-y-2">
          {mesocycles.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <Link to={`/mesocycle/${m.id}/volume`} className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{m.name}</h3>
                  <p className="text-xs text-slate-500">
                    {m.days_per_week} days/week
                    {' | '}
                    {new Date(m.started_at).toLocaleDateString()}
                    {m.ended_at ? ` - ${new Date(m.ended_at).toLocaleDateString()}` : ' (active)'}
                  </p>
                </Link>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${m.ended_at ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                    {m.ended_at ? 'Completed' : 'Active'}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, m.id, m.name)}
                    disabled={deleting === m.id}
                    className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                    {deleting === m.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
