// The in-progress workout lives in localStorage so it survives reloads and
// offline restarts. The logger writes it, Finish clears it, and the
// ActiveWorkoutBar mini-bar reads it to stay visible across every tab.
export const ACTIVE_SESSION_KEY = 'activeSession'
export const REST_TIMER_KEY = 'restTimerEndsAt'

export function getActiveSession() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || 'null')
  } catch {
    return null
  }
}
