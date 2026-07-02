import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

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
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title="New training block" subtitle="Pick a split or build your own" backTo="/programs/history" />

      <div className="flex flex-wrap gap-2">
        {presets.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className={`min-h-10 rounded-full px-3.5 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
              p.days.length === daysPerWeek && p.days.every((d, i) => dayLabels[i] === d)
                ? 'bg-ink text-page'
                : 'border border-line-2 bg-card text-ink-2 active:bg-sunken'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-line bg-card p-5 shadow-card">
        {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
        <Input
          label="Block name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="e.g., Hypertrophy Block 1"
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-2">Days per week</label>
          <div className="flex gap-1.5">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} type="button" onClick={() => handleDaysChange(n)}
                className={`h-11 flex-1 rounded-field text-sm font-medium transition-all active:scale-[0.95] ${
                  n === daysPerWeek
                    ? 'bg-accent-solid font-semibold text-on-accent'
                    : 'bg-sunken text-ink-2 active:bg-line'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink-2">Day labels</label>
          {dayLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-ink-3">Day {i + 1}</span>
              <Input
                type="text"
                value={label}
                onChange={e => updateLabel(i, e.target.value)}
                required
                placeholder={`Day ${i + 1}`}
                className="flex-1"
              />
            </div>
          ))}
        </div>

        <Button type="submit" disabled={loading} className="w-full min-h-12">
          {loading ? 'Creating…' : 'Create block'}
        </Button>
      </form>
    </div>
  )
}
