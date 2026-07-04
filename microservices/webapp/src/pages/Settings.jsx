import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getUser, clearSession, isAdmin } from '../auth/session'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import BottomSheet from '../components/ui/BottomSheet'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useToast } from '../lib/toastContext'
import { useTheme } from '../lib/themeContext'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

function ChangePasswordSheet({ open, onClose }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const showToast = useToast()

  function close() {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (next !== confirm) {
      setError('New passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.changePassword({ current_password: current, new_password: next })
      showToast('Password updated', 'success')
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="Change password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
        <Input
          label="Current password"
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          label="New password"
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
        <Button type="submit" disabled={loading} className="w-full min-h-12">
          {loading ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </BottomSheet>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const user = getUser() || {}
  const initial = (user.name || '?').charAt(0).toUpperCase()
  const { theme, setTheme } = useTheme()
  const [passwordOpen, setPasswordOpen] = useState(false)

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <Card className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-solid font-display text-lg font-semibold text-on-accent">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
            {user.role === 'admin' && (
              <span className="rounded-full bg-wash px-2 py-0.5 text-[11px] font-semibold text-accent">Admin</span>
            )}
          </div>
          <div className="truncate text-sm text-ink-3">{user.email}</div>
        </div>
      </Card>

      {isAdmin() && (
        <Card className="!p-0 divide-y divide-line">
          <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
            Coach's corner
          </div>
          <Link to="/admin/templates" className="flex min-h-12 items-center justify-between px-4 py-3 transition-colors active:bg-sunken">
            <div>
              <div className="text-sm font-medium text-ink">Program templates</div>
              <div className="text-[13px] text-ink-3">Build blocks everyone can start</div>
            </div>
            <svg className="h-4 w-4 shrink-0 text-ink-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link to="/admin/users" className="flex min-h-12 items-center justify-between px-4 py-3 transition-colors active:bg-sunken">
            <div>
              <div className="text-sm font-medium text-ink">Members</div>
              <div className="text-[13px] text-ink-3">Password reset codes</div>
            </div>
            <svg className="h-4 w-4 shrink-0 text-ink-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </Card>
      )}

      <Card className="!p-0 divide-y divide-line">
        <div className="px-4 py-3">
          <div className="mb-2.5 text-sm text-ink">Appearance</div>
          <div className="grid grid-cols-3 gap-1 rounded-btn bg-sunken p-1" role="radiogroup" aria-label="Theme">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={theme === opt.value}
                onClick={() => setTheme(opt.value)}
                className={`min-h-10 rounded-[8px] text-sm transition-all active:scale-[0.97] ${
                  theme === opt.value
                    ? 'bg-card font-semibold text-ink shadow-card'
                    : 'font-medium text-ink-3 hover:text-ink-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setPasswordOpen(true)}
          className="flex min-h-12 w-full items-center justify-between px-4 py-3 text-left transition-colors active:bg-sunken"
        >
          <span className="text-sm text-ink">Password</span>
          <span className="text-sm font-medium text-accent">Change</span>
        </button>
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Units</span>
          <span className="text-sm text-ink-3">kg · switch to lb per set while logging</span>
        </div>
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">App</span>
          <span className="text-sm text-ink-3">LiftNotebook</span>
        </div>
        <button
          onClick={logout}
          className="min-h-12 w-full px-4 py-3 text-left text-sm font-medium text-danger transition-colors active:bg-danger-wash"
        >
          Sign out
        </button>
      </Card>

      <ChangePasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
