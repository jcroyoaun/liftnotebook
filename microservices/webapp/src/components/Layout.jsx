import { Outlet, Link, useNavigate } from 'react-router-dom'

export default function Layout() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-slate-900">
            LiftNotebook
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
              Workout
            </Link>
            <Link to="/progress" className="text-sm text-slate-600 hover:text-slate-900">
              Progress
            </Link>
            <Link to="/mesocycles" className="text-sm text-slate-600 hover:text-slate-900">
              History
            </Link>
            <span className="text-xs text-slate-400">{user.name}</span>
            <button onClick={logout} className="text-xs text-red-500 hover:text-red-700">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
