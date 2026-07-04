import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { isAdmin } from '../auth/session'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import BottomSheet from '../components/ui/BottomSheet'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

// User-facing template browser: coach-built blocks anyone can start as their
// own training block in one tap.
export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    api.getTemplates()
      .then(data => setTemplates(data.templates || []))
      .catch(err => toast(err.message))
      .finally(() => setLoading(false))
  }, [toast])

  async function start(template) {
    setStarting(true)
    try {
      await api.startTemplate(template.id)
      toast(`${template.name} started. Go lift.`, 'success')
      navigate('/')
    } catch (err) {
      toast(err.message)
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Templates"
        subtitle="Coach-built blocks, ready to run"
        backTo="/programs/history"
        action={
          isAdmin() && (
            <Link to="/admin/templates" className="text-sm font-medium text-accent">
              Manage
            </Link>
          )
        }
      />

      {templates.length === 0 && (
        <div className="rounded-card border border-line bg-card p-6 text-center shadow-card">
          <p className="font-display text-lg font-semibold text-ink">Nothing here yet</p>
          <p className="mt-1 text-sm text-ink-3">
            {isAdmin()
              ? 'Build the first template and everyone can start it from here.'
              : 'Your coach hasn’t published a block yet. Build your own instead.'}
          </p>
          <div className="mt-4">
            {isAdmin() ? (
              <Link to="/admin/templates/new" className="text-sm font-semibold text-accent">Create a template</Link>
            ) : (
              <Link to="/programs/new" className="text-sm font-semibold text-accent">Create a custom block</Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t, i) => {
          const exerciseCount = (t.days || []).reduce((n, d) => n + (d.exercises?.length || 0), 0)
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="block w-full rounded-card border border-line bg-card p-4 text-left shadow-card transition-all active:scale-[0.99] animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display truncate text-[17px] font-semibold text-ink">{t.name}</h3>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{t.description}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-wash px-2.5 py-1 text-[11px] font-semibold text-accent">
                  {t.days_per_week}×/week
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {(t.days || []).map(d => (
                  <span key={d.id} className="rounded-full bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-2">
                    {d.label}
                  </span>
                ))}
                <span className="ml-auto text-[11px] text-ink-3">{exerciseCount} exercises</span>
              </div>
            </button>
          )
        })}
      </div>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''}>
        {selected && (
          <div className="space-y-4">
            {selected.description && <p className="text-sm text-ink-2">{selected.description}</p>}
            <div className="space-y-3">
              {(selected.days || []).map(d => (
                <div key={d.id} className="rounded-field border border-line bg-raised p-3">
                  <div className="mb-2 text-sm font-semibold text-ink">
                    Day {d.day_number}: {d.label}
                  </div>
                  {(d.exercises || []).length === 0 ? (
                    <p className="text-[13px] text-ink-3">Rest-day flavored. No exercises.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {d.exercises.map(ex => (
                        <li key={ex.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-ink-2">{ex.exercise_name}</span>
                          <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                            {ex.target_sets} × failure
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <Button className="w-full min-h-12" disabled={starting} onClick={() => start(selected)}>
              {starting ? 'Starting…' : 'Start this block'}
            </Button>
            <p className="text-center text-[12px] text-ink-3">
              Copies the block into your programs — tweak any day after.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
