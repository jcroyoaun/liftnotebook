import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { setSession } from '../auth/session'
import AuthShell from '../components/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
        <div className="space-y-1.5 text-center text-sm text-ink-3">
          <p>
            No account? <Link to="/register" className="font-medium text-accent hover:underline">Register</Link>
          </p>
          <p>
            <Link to="/reset-password" className="underline-offset-2 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
