import { useNavigate } from 'react-router-dom'
import { getUser, clearSession } from '../auth/session'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'

export default function Settings() {
  const navigate = useNavigate()
  const user = getUser() || {}
  const initial = (user.name || '?').charAt(0).toUpperCase()

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <Card className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
          <div className="text-sm text-slate-500 truncate">{user.email}</div>
        </div>
      </Card>

      <Card className="!p-0 divide-y divide-slate-100">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-700">Units</span>
          <span className="text-sm text-slate-400">kg</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-700">App</span>
          <span className="text-sm text-slate-400">LiftNotebook</span>
        </div>
        <button onClick={logout} className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 active:bg-red-50">
          Sign out
        </button>
      </Card>
    </div>
  )
}
