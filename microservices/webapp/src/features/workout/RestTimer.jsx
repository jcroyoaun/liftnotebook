import { useEffect, useRef, useState } from 'react'

// Rest timer between sets. Stores an absolute end timestamp (not a live
// countdown) so backgrounding/reloading the app never drifts the clock.
// Honest platform notes: vibration does not exist on iOS Safari, and no
// browser guarantees firing while fully backgrounded — the wake lock keeps
// the screen on instead, which is what actually works at the gym.
export default function RestTimer({ endsAt, onDismiss, onAdjust }) {
  const [now, setNow] = useState(() => Date.now())
  const firedRef = useRef(false)

  useEffect(() => {
    if (!endsAt) return
    const tick = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(tick)
  }, [endsAt])

  // Keep the screen awake while resting (supported on Chrome + iOS 16.4+).
  useEffect(() => {
    if (!endsAt || !navigator.wakeLock) return
    let lock = null
    let released = false

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // Denied (e.g. low battery) — non-fatal.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible' && !released) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [endsAt])

  const remaining = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0
  const done = endsAt && remaining === 0
  const elapsedOver = endsAt ? Math.round((now - endsAt) / 1000) : 0

  // The "Go!" banner earns ~a minute of attention, then gets out of the way
  // on its own — nobody should owe the bar a Dismiss tap mid-workout.
  useEffect(() => {
    if (done && elapsedOver >= 60) onDismiss()
  }, [done, elapsedOver, onDismiss])

  // Chime + vibrate once when the timer elapses.
  useEffect(() => {
    if (!done || firedRef.current) return
    firedRef.current = true
    navigator.vibrate?.([200, 100, 200])
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start()
      osc.stop(ctx.currentTime + 0.6)
    } catch {
      // No audio context available — visual banner still shows.
    }
  }, [done])

  useEffect(() => {
    firedRef.current = false
  }, [endsAt])

  if (!endsAt) return null

  const mins = Math.floor(remaining / 60)
  const secs = String(remaining % 60).padStart(2, '0')

  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-colors duration-300 animate-rise ${
        done ? 'bg-accent-solid text-on-accent' : 'bg-ink text-page'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-[0.1em] opacity-70">{done ? 'Go!' : 'Rest'}</span>
        <span className="text-2xl font-bold tabular-nums" data-testid="rest-timer">
          {done ? 'Next set' : `${mins}:${secs}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {!done && (
          <>
            <button onClick={() => onAdjust(-30)} className="min-h-9 rounded-lg bg-page/15 px-2.5 py-1 text-xs transition-colors hover:bg-page/25 active:scale-95">−30s</button>
            <button onClick={() => onAdjust(30)} className="min-h-9 rounded-lg bg-page/15 px-2.5 py-1 text-xs transition-colors hover:bg-page/25 active:scale-95">+30s</button>
          </>
        )}
        <button onClick={onDismiss} className="min-h-9 rounded-lg bg-page/25 px-3 py-1 text-xs font-medium transition-colors hover:bg-page/35 active:scale-95">
          {done ? 'Dismiss' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
