// Central session handling. The workouttracker API issues a JWT with a 72h
// expiry; decode the payload locally so protected routes can reject stale
// tokens up front instead of waiting for the first failed API call.

const listeners = new Set()

function decodePayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function getToken() {
  return localStorage.getItem('token')
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export function isTokenValid() {
  const token = getToken()
  if (!token) return false
  const payload = decodePayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 > Date.now()
}

export function setSession(token, user) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
  notify()
}

export function clearSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  notify()
}

export function onSessionChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) fn()
}
