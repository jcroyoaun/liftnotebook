import { Link } from 'react-router-dom'

// Shared shell for the signed-out pages (login / register / reset password):
// aurora backdrop, barbell mark, gradient wordmark, house motto.
export default function AuthShell({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-page px-5 py-10">
      <div className="auth-aurora" aria-hidden="true" />
      <div className="relative w-full max-w-sm animate-rise">
        <Link to="/login" className="block" aria-label="LiftNotebook home">
          <svg viewBox="0 0 48 24" className="mx-auto mb-3 h-6 w-12 text-accent" fill="currentColor" aria-hidden="true">
            <rect x="2" y="10.5" width="44" height="3" rx="1.5" />
            <rect x="8" y="4" width="4" height="16" rx="1.5" />
            <rect x="13" y="6.5" width="3" height="11" rx="1.5" />
            <rect x="36" y="4" width="4" height="16" rx="1.5" />
            <rect x="32" y="6.5" width="3" height="11" rx="1.5" />
          </svg>
          <h1 className="font-display mb-1 text-center text-[34px] font-bold text-ink">
            Lift<span className="text-grad">Notebook</span>
          </h1>
        </Link>
        <p className="mb-8 text-center text-sm text-ink-3">Your free workout tracker</p>
        {children}
      </div>
    </div>
  )
}
