import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { setSession } from '../auth/session'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.register({ name, email, password, invite_code: inviteCode })
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
          Lift<span className="text-grad">Notebook</span>
        </h1>
        <p className="mb-8 text-center text-sm text-ink-3">Your training, written down</p>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-semibold text-ink">Create Account</h2>
          {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
          <Input label="Name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          <Input
            label="Invite Code"
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            placeholder="Ask the person who invited you"
          />
          <Button type="submit" disabled={loading} className="w-full min-h-12">
            {loading ? 'Creating...' : 'Create Account'}
          </Button>
          <p className="text-center text-sm text-ink-3">
            Already have an account? <Link to="/login" className="font-medium text-accent hover:underline">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
