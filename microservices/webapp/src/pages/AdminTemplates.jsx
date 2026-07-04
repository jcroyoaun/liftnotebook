import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import ConfirmSheet from '../components/ui/ConfirmSheet'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

// Admin: manage the shared template catalog.
export default function AdminTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api.getTemplates()
      .then(data => setTemplates(data.templates || []))
      .catch(err => toast(err.message))
      .finally(() => setLoading(false))
  }, [toast])

  async function remove(t) {
    try {
      await api.deleteTemplate(t.id)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
      toast('Template deleted', 'success')
    } catch (err) {
      toast(err.message)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Program templates"
        subtitle="Blocks everyone can start"
        backTo="/settings"
        action={
          <Link to="/admin/templates/new" className="text-sm font-semibold text-accent">
            New template
          </Link>
        }
      />

      {templates.length === 0 && (
        <div className="rounded-card border border-line bg-card p-6 text-center shadow-card">
          <p className="font-display text-lg font-semibold text-ink">No templates yet</p>
          <p className="mt-1 text-sm text-ink-3">Write the first block — house style: 2 sets, to failure.</p>
          <div className="mt-4">
            <Link to="/admin/templates/new" className="text-sm font-semibold text-accent">Create a template</Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map(t => {
          const exerciseCount = (t.days || []).reduce((n, d) => n + (d.exercises?.length || 0), 0)
          return (
            <div key={t.id} className="rounded-card border border-line bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display truncate text-[17px] font-semibold text-ink">{t.name}</h3>
                  <p className="mt-0.5 text-sm text-ink-3">
                    {t.days_per_week} days/week · {exerciseCount} exercises
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    to={`/admin/templates/${t.id}/edit`}
                    aria-label={`edit ${t.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink active:scale-95"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => setDeleting(t)}
                    aria-label={`delete ${t.name}`}
                    className="grid h-10 w-10 place-items-center rounded-full text-ink-3 transition-colors active:bg-danger-wash active:text-danger"
                  >
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmSheet
        open={!!deleting}
        title="Delete template?"
        body={`"${deleting?.name}" disappears from the browser for everyone. Blocks already started from it are untouched.`}
        confirmLabel="Delete template"
        onConfirm={() => remove(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
