import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { setSession, isTokenValid } from '../auth/session'
import AuthShell from '../components/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { BUILD_ID } from '../lib/version'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Already signed in? Skip the form.
  useEffect(() => {
    if (isTokenValid()) navigate('/', { replace: true })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login({ email, password })
      setSession(data.token, data.user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Sign In</h2>
        {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        <Button type="submit" disabled={loading} className="w-full min-h-12">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
        {/* Padded to ≥44px hit targets; negative margins keep the visual scale. */}
        <div className="text-center text-sm text-ink-3">
          <p>
            No account?{' '}
            <Link
              to="/register"
              className="-mx-1.5 -my-1 inline-block px-1.5 py-3 font-medium text-accent hover:underline"
            >
              Register
            </Link>
          </p>
          <p>
            <Link
              to="/reset-password"
              className="-mx-1.5 -my-1 inline-block px-1.5 py-3 underline-offset-2 hover:text-ink hover:underline"
            >
              Forgot password?
            </Link>
          </p>
        </div>
        <p className="pt-1 text-center text-[11px] text-ink-4">build {BUILD_ID}</p>
      </form>
    </AuthShell>
  )
}
