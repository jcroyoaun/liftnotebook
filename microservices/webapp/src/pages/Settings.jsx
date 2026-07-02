import { useNavigate } from 'react-router-dom'
import { getUser, clearSession } from '../auth/session'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function Settings() {
  const navigate = useNavigate()
  const user = getUser() || {}

  function logout() {
    clearSession()
    navigate('/login')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <Card>
        <div className="text-sm font-medium text-slate-900">{user.name}</div>
        <div className="text-sm text-slate-500">{user.email}</div>
      </Card>
      <Card className="flex items-center justify-between">
        <div className="text-sm text-slate-700">Sign out of this device</div>
        <Button variant="danger" onClick={logout}>Logout</Button>
      </Card>
    </div>
  )
}
