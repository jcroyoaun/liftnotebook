import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'

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
      navigate(`/programs/${data.mesocycle.id}/setup/${data.days[0].id}`)
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
    <div className="max-w-md mx-auto space-y-4">
      <PageHeader title="New training block" subtitle="Pick a split or build your own" backTo="/programs/history" />

      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className={`text-xs px-3.5 py-2 rounded-full font-medium transition-colors ${
              p.days.length === daysPerWeek && p.days.every((d, i) => dayLabels[i] === d)
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 active:bg-slate-50'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Block name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            placeholder="e.g., Hypertrophy Block 1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Days per week</label>
          <div className="flex gap-1.5">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} type="button" onClick={() => handleDaysChange(n)}
                className={`h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${n === daysPerWeek ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Day labels</label>
          {dayLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-12 shrink-0">Day {i + 1}</span>
              <input type="text" value={label} onChange={e => updateLabel(i, e.target.value)} required
                placeholder={`Day ${i + 1}`}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold active:bg-blue-700 disabled:opacity-50">
          {loading ? 'Creating…' : 'Create block'}
        </button>
      </form>
    </div>
  )
}
