import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { setSession, isTokenValid } from '../auth/session'
import AuthShell from '../components/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Register() {
  // Invite links (/register?code=...) prefill the code so friends only type
  // name, email, password.
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(searchParams.get('code') || '')
  const [inviteError, setInviteError] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inviteRef = useRef(null)
  const navigate = useNavigate()

  // Already signed in? This page has nothing for you.
  useEffect(() => {
    if (isTokenValid()) navigate('/', { replace: true })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.register({ name, email, password, invite_code: inviteCode })
      setSession(data.token, data.user)
      navigate('/')
    } catch (err) {
      // The API's invite rejection is server-speak — translate it and point
      // at the field that needs fixing.
      if (/invite code/i.test(err.message)) {
        setInviteError(true)
        setError("That invite code didn't match — ask the person who invited you.")
        inviteRef.current?.focus()
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink">Create Account</h2>
        {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
        <Input label="Name" type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <div>
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
          <p className="mt-1 text-xs text-ink-3">8+ characters</p>
        </div>
        {/* Whether a code is required is the SERVER's call (open registration
            is legitimate on dev stacks) — so no client-side required here;
            a rejection highlights the field with human copy instead. */}
        <Input
          label="Invite Code"
          type="text"
          value={inviteCode}
          onChange={e => { setInviteCode(e.target.value); setInviteError(false) }}
          ref={inviteRef}
          placeholder="Ask the person who invited you"
          className={inviteError ? 'ring-2 ring-danger/40' : ''}
        />
        <Button type="submit" disabled={loading} className="w-full min-h-12">
          {loading ? 'Creating...' : 'Create Account'}
        </Button>
        <p className="text-center text-sm text-ink-3">
          Already have an account? <Link to="/login" className="font-medium text-accent hover:underline">Sign In</Link>
        </p>
      </form>
    </AuthShell>
  )
}
