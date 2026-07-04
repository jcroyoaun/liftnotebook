import { useState, useEffect } from 'react'
import { api } from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import BottomSheet from '../components/ui/BottomSheet'
import Button from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../lib/toastContext'

// Admin: member list + one-time password reset codes. No email delivery by
// design — the admin hands the code to the member out-of-band.
export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetFor, setResetFor] = useState(null)
  const [resetToken, setResetToken] = useState(null)
  const [generating, setGenerating] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.getAdminUsers()
      .then(data => setUsers(data.users || []))
      .catch(err => toast(err.message))
      .finally(() => setLoading(false))
  }, [toast])

  async function generate(user) {
    setResetFor(user)
    setResetToken(null)
    setGenerating(true)
    try {
      const data = await api.createResetToken(user.id)
      setResetToken(data.reset_token)
    } catch (err) {
      toast(err.message)
      setResetFor(null)
    } finally {
      setGenerating(false)
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(resetToken.token)
      toast('Code copied', 'success')
    } catch {
      toast('Could not copy — long-press the code instead')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Members" subtitle="Everyone training here" backTo="/settings" />

      <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
        <ul className="divide-y divide-line">
          {users.map(u => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken font-display text-sm font-semibold text-ink-2">
                {(u.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{u.name}</span>
                  {u.role === 'admin' && (
                    <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-accent">Admin</span>
                  )}
                </div>
                <div className="truncate text-[13px] text-ink-3">{u.email}</div>
              </div>
              <button
                onClick={() => generate(u)}
                className="shrink-0 rounded-btn border border-line-2 px-3 py-2 text-[13px] font-medium text-ink-2 transition-all active:scale-[0.97] active:bg-sunken"
              >
                Reset code
              </button>
            </li>
          ))}
        </ul>
      </div>

      <BottomSheet
        open={!!resetFor}
        onClose={() => { setResetFor(null); setResetToken(null) }}
        title={`Reset code for ${resetFor?.name || ''}`}
      >
        {generating && <Skeleton className="h-24" />}
        {resetToken && (
          <div className="space-y-4">
            <div className="rounded-field border border-line bg-sunken p-4 text-center">
              <div className="select-all break-all font-mono text-lg font-semibold tracking-wider text-ink">
                {resetToken.token}
              </div>
              <div className="mt-1.5 text-[12px] text-ink-3">
                Expires {new Date(resetToken.expiry).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' · '}one-time use
              </div>
            </div>
            <Button onClick={copyCode} className="w-full min-h-12">Copy code</Button>
            <p className="text-center text-[13px] leading-relaxed text-ink-3">
              Send it to {resetFor?.name?.split(' ')[0] || 'them'} — they redeem it at{' '}
              <span className="font-medium text-ink-2">liftnotebook.app/reset-password</span>.
              Generating a new code cancels this one.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
