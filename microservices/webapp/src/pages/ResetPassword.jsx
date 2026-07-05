import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import AuthShell from '../components/AuthShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

// Redeems a one-time reset code. There is no email delivery on purpose —
// codes come from the admin (the person who runs this LiftNotebook).

// API validation errors arrive as 'field: message' — strip the field prefix
// and translate the common rejection into human copy.
function friendlyError(raw) {
  const msg = String(raw || '')
    .split('\n')
    .map(line => line.replace(/^[a-z_]+:\s*/i, ''))
    .join('\n')
  if (msg.includes('invalid or expired reset code')) {
    return "That reset code didn't work — it may have expired. Ask your admin for a fresh one."
  }
  return msg
}

export default function ResetPassword() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.resetPassword({ token: token.trim().toUpperCase(), password })
      setDone(true)
    } catch (err) {
      setError(friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell>
        <div className="space-y-4 rounded-card border border-line bg-card p-6 text-center shadow-card">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-wash text-ok animate-stamp">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Password reset</h2>
            <p className="mt-1 text-sm text-ink-3">You're back in business. Sign in with your new password.</p>
          </div>
          <Link
            to="/login"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-btn bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-all duration-150 hover:bg-accent-press active:scale-[0.97]"
          >
            Sign In
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-card p-6 shadow-card">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Reset Password</h2>
          <p className="mt-1 text-sm text-ink-3">
            Enter the reset code from your admin — the person who invited you can generate one in seconds.
          </p>
        </div>
        {error && <div className="rounded-lg bg-danger-wash p-2.5 text-sm text-danger">{error}</div>}
        <Input
          label="Reset code"
          type="text"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="ABCD2EFGH3JKLM4NOPQ5RSTUV6"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          spellCheck={false}
          className="font-mono tracking-wide uppercase"
          required
        />
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
          {loading ? 'Resetting...' : 'Reset Password'}
        </Button>
        <p className="text-center text-sm text-ink-3">
          Remembered it? <Link to="/login" className="font-medium text-accent hover:underline">Sign In</Link>
        </p>
      </form>
    </AuthShell>
  )
}
