import { useNavigate } from 'react-router-dom'
import { getUser, clearSession } from '../auth/session'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import { useTheme } from '../lib/themeContext'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

export default function Settings() {
  const navigate = useNavigate()
  const user = getUser() || {}
  const initial = (user.name || '?').charAt(0).toUpperCase()
  const { theme, setTheme } = useTheme()

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
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
          <div className="truncate text-sm text-ink-3">{user.email}</div>
        </div>
      </Card>

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
    </div>
  )
}
