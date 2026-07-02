import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getActiveSession, REST_TIMER_KEY } from '../../lib/activeSession'

// Persistent mini-bar (MacroFactor pattern): while a workout is in progress
// the session stays reachable from every tab — minimizing the logger never
// loses it. Tap anywhere on the bar to re-enter; no destructive actions here.
export default function ActiveWorkoutBar() {
  // Both navigation (useLocation) and the 1s tick re-render this component,
  // and the active session is re-read from localStorage on every render —
  // no state mirroring needed.
  useLocation()
  const [now, setNow] = useState(() => Date.now())

  // 1s tick drives the rest countdown and catches changes from other tabs.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const active = getActiveSession()
  if (!active) return null

  const endsAt = Number(localStorage.getItem(REST_TIMER_KEY))
  const restLeft = endsAt > now ? Math.ceil((endsAt - now) / 1000) : null
  const restLabel = restLeft
    ? ` · rest ${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`
    : ''

  return (
    <Link
      to={`/workout/${active.id}`}
      data-testid="active-workout-bar"
      className="block border-t border-line bg-raised px-4 py-2 transition-colors active:bg-sunken"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-solid opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-solid" />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-ink">Workout in progress</div>
            <div className="truncate text-[11px] text-ink-3 tabular-nums">
              {active.label}
              {restLabel}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[13px] font-semibold text-accent">Resume →</span>
      </div>
    </Link>
  )
}
