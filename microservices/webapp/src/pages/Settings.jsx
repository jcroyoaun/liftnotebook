import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getUser, clearSession, isAdmin } from '../auth/session'
import {
  isPushSupported,
  restAlarmEnabled,
  enableRestAlarm,
  disableRestAlarm,
  prefetchPushKey,
  checkPushHealth,
  getPushStatus,
} from '../lib/push'
import { REST_OPTIONS, getRestSeconds, setRestSeconds } from '../lib/restPrefs'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import BottomSheet from '../components/ui/BottomSheet'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { useToast } from '../lib/toastContext'
import { useTheme } from '../lib/themeContext'
import { BUILD_ID } from '../lib/version'

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
          {loading ? 'Updating...' : 'Update password'}
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
  const [alarmOn, setAlarmOn] = useState(() => restAlarmEnabled())
  const [alarmBusy, setAlarmBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [serverSubscribed, setServerSubscribed] = useState(
    () => getPushStatus().subscribedOnServer === true,
  )
  const [restSeconds, setRestSecondsState] = useState(() => getRestSeconds())
  const showToast = useToast()

  const pushSupported = isPushSupported()
  const showInstallHint =
    !pushSupported &&
    /iPhone|iPad/.test(navigator.userAgent) &&
    (navigator.standalone === false || !window.matchMedia('(display-mode: standalone)').matches)
  const restSelected = restSeconds === null ? 'off' : restSeconds

  // Prefetch the VAPID key (instant subscribe on toggle) and reconcile the
  // toggle with reality — iOS revokes subscriptions silently.
  useEffect(() => {
    let cancelled = false
    prefetchPushKey().then((res) => {
      if (!cancelled && res) setServerSubscribed(res.subscribed)
    })
    checkPushHealth().then((health) => {
      if (cancelled) return
      if (health === 'revoked' || health === 'permission-lost') {
        setAlarmOn(false)
        showToast('iOS turned the rest alarm off — flip it back on to re-enable.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [showToast])

  async function toggleAlarm() {
    setAlarmBusy(true)
    try {
      if (alarmOn) {
        await disableRestAlarm()
        setAlarmOn(false)
        showToast('Rest alarm off', 'success')
      } else {
        await enableRestAlarm()
        setAlarmOn(true)
        setServerSubscribed(true)
        showToast('Rest alarm on — pocket your phone, we buzz you', 'success')
      }
    } catch (err) {
      showToast(err.message)
    } finally {
      setAlarmBusy(false)
    }
  }

  async function sendTest() {
    setTestBusy(true)
    try {
      await api.sendTestPush()
      showToast('Test sent — lock your phone and watch for it.', 'success')
    } catch (err) {
      showToast(err.message)
    } finally {
      setTestBusy(false)
    }
  }

  function pickRest(value) {
    setRestSeconds(value)
    setRestSecondsState(value === 'off' ? null : value)
  }

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
        <div className="px-4 py-3">
          <div className="text-sm text-ink">Rest timer</div>
          <div className="mb-2.5 text-[13px] text-ink-3">Starts after every logged set.</div>
          <div className="grid grid-cols-4 gap-1 rounded-btn bg-sunken p-1" role="radiogroup" aria-label="Rest timer">
            {REST_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                role="radio"
                aria-checked={restSelected === opt.value}
                onClick={() => pickRest(opt.value)}
                className={`min-h-10 rounded-[8px] text-sm transition-all active:scale-[0.97] ${
                  restSelected === opt.value
                    ? 'bg-card font-semibold text-ink shadow-card'
                    : 'font-medium text-ink-3 hover:text-ink-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <button
            role="switch"
            aria-checked={alarmOn}
            aria-label="Rest alarm notifications"
            disabled={alarmBusy || !pushSupported}
            onClick={toggleAlarm}
            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-sunken disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block text-sm text-ink">Rest alarm</span>
              <span className="block text-[13px] text-ink-3">
                {pushSupported
                  ? 'Notification when rest ends, even with the screen off'
                  : 'Not supported here — on iPhone, install the app first'}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                alarmOn ? 'bg-accent-solid' : 'bg-line-2'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all ${
                  alarmOn ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
          {showInstallHint && (
            <p className="px-4 pb-3 text-sm text-ink-3">
              On iPhone: install the app first — Share → Add to Home Screen — then enable this.
            </p>
          )}
          {(alarmOn || serverSubscribed) && (
            <div className="px-4 pb-3">
              <Button
                variant="secondary"
                onClick={sendTest}
                disabled={testBusy}
                className="w-full"
              >
                Send test notification
              </Button>
            </div>
          )}
        </div>
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Units</span>
          <span className="text-sm text-ink-3">kg · switch to lb per set while logging</span>
        </div>
        <div className="flex min-h-12 items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">App</span>
          <span className="text-sm text-ink-3">LiftNotebook · build {BUILD_ID}</span>
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
