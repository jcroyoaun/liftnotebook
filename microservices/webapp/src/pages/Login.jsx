import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { setSession } from '../auth/session'
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
    <div className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="font-display mb-1 text-center text-[34px] font-bold text-ink">
          Lift<span className="italic text-accent">Notebook</span>
        </h1>
        <p className="mb-8 text-center text-sm text-ink-3">Track your gains, not your wallet</p>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-ink">Sign In</h2>
          {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full min-h-12">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <p className="text-center text-sm text-ink-3">
            No account? <Link to="/register" className="font-medium text-accent hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
