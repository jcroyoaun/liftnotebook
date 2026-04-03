import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function CreateMesocycle() {
  const [name, setName] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(4)
  const [dayLabels, setDayLabels] = useState(['Push', 'Pull', 'Legs', 'Upper'])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleDaysChange(num) {
    const n = Math.max(1, Math.min(7, num))
    setDaysPerWeek(n)
    setDayLabels(prev => {
      const next = [...prev]
      while (next.length < n) next.push(`Day ${next.length + 1}`)
      return next.slice(0, n)
    })
  }

  function updateLabel(idx, val) {
    setDayLabels(prev => {
      const next = [...prev]
      next[idx] = val
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = {
        name,
        days_per_week: daysPerWeek,
        days: dayLabels.map((label, i) => ({ day_number: i + 1, label })),
      }
      const data = await api.createMesocycle(body)
      navigate(`/mesocycle/${data.mesocycle.id}/setup/${data.days[0].id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const presets = [
    { label: 'PPL', days: ['Push', 'Pull', 'Legs'] },
    { label: 'PPL x2', days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'] },
    { label: 'Upper/Lower', days: ['Upper', 'Lower', 'Upper', 'Lower'] },
    { label: 'Full Body', days: ['Full Body A', 'Full Body B', 'Full Body C'] },
  ]

  function applyPreset(p) {
    setDaysPerWeek(p.days.length)
    setDayLabels([...p.days])
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-4">New Mesocycle</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200">
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mesocycle Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            placeholder="e.g., Hypertrophy Block 1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Days Per Week</label>
          <div className="flex gap-1">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} type="button" onClick={() => handleDaysChange(n)}
                className={`w-9 h-9 rounded-lg text-sm font-medium ${n === daysPerWeek ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Day Labels</label>
          {dayLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-12">Day {i + 1}</span>
              <input type="text" value={label} onChange={e => updateLabel(i, e.target.value)} required
                placeholder={`Day ${i + 1}`}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Mesocycle'}
        </button>
      </form>
    </div>
  )
}
