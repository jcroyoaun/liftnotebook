// Rest-timer web push. The in-app timer bar handles the screen-on case; this
// covers pocket-phone rest at the gym: the server fires a push when rest
// ends and the service worker shows a notification (works on Android Chrome
// and iOS 16.4+ installed PWAs).
import { api } from '../api/client'

const FLAG = 'restAlarmEnabled'

// Cached GET /v1/push/public-key response: { publicKey, subscribed }.
// Prefetched on Settings mount so enableRestAlarm never has to await the
// network before subscribing.
let keyCache = null
let keyCachePromise = null

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function restAlarmEnabled() {
  return (
    localStorage.getItem(FLAG) === 'on' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Fetch (and cache) the VAPID key + server subscription state. Settings
// calls this on mount so the subscribe step after the permission prompt is
// instant.
export function prefetchPushKey() {
  if (!keyCachePromise) {
    keyCachePromise = api
      .getPushPublicKey()
      .then((res) => {
        keyCache = { publicKey: res.public_key || '', subscribed: Boolean(res.subscribed) }
        return keyCache
      })
      .catch(() => {
        keyCachePromise = null // let the next caller retry
        return null
      })
  }
  return keyCachePromise
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

export async function enableRestAlarm() {
  if (!isPushSupported()) {
    throw new Error('Notifications are not supported in this browser. On iPhone, install the app to your home screen first.')
  }
  // iOS: the permission prompt must be requested synchronously within the
  // user gesture — awaiting the network first can expire transient
  // activation and silently deny. Key fetch and subscribe come after.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed')
  }
  let cached = keyCache
  if (!cached?.publicKey) {
    const res = await api.getPushPublicKey()
    cached = keyCache = { publicKey: res.public_key || '', subscribed: Boolean(res.subscribed) }
  }
  if (!cached.publicKey) {
    throw new Error('Push is not configured on the server yet')
  }
  // subscribe() can hang indefinitely when the push service is unreachable
  // (and always does in headless browsers) — timebox it so the toggle fails
  // loudly with a toast instead of freezing in the busy state forever.
  const reg = await withTimeout(navigator.serviceWorker.ready, 5000, 'The app is still installing — try again in a moment.')
  const sub = await withTimeout(
    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cached.publicKey),
    }),
    12000,
    "Couldn't reach the push service — check your connection and try again.",
  )
  const json = sub.toJSON()
  // Exact shape only — the API rejects unknown JSON keys.
  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  })
  localStorage.setItem(FLAG, 'on')
  keyCache = { ...cached, subscribed: true }
}

export async function disableRestAlarm() {
  localStorage.removeItem(FLAG)
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await api.deletePushSubscription({ endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
  } catch {
    // Best-effort: the flag is off, so no alarms get scheduled either way.
  }
}

// Startup health check: iOS silently revokes push subscriptions (e.g. after
// three pushes that show no notification), leaving the local flag stale and
// the toggle lying. Clears the flag when reality disagrees. Never throws.
// Returns 'ok' | 'off' | 'unsupported' | 'revoked' | 'permission-lost'.
export async function checkPushHealth() {
  try {
    if (!isPushSupported()) return 'unsupported'
    if (localStorage.getItem(FLAG) !== 'on') return 'off'
    if (Notification.permission !== 'granted') {
      localStorage.removeItem(FLAG)
      return 'permission-lost'
    }
    // Race a timeout so a never-activating SW (e.g. dev server) can't hang us.
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ])
    if (!reg) return 'ok' // can't verify — don't clear a flag we can't disprove
    const sub = await reg.pushManager.getSubscription()
    if (!sub) {
      localStorage.removeItem(FLAG)
      return 'revoked'
    }
    return 'ok'
  } catch {
    return 'ok'
  }
}

// Synchronous snapshot for Settings rendering. subscribedOnServer comes from
// the cached public-key response (null until prefetchPushKey resolves).
export function getPushStatus() {
  return {
    supported: isPushSupported(),
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    flagOn: localStorage.getItem(FLAG) === 'on',
    subscribedOnServer: keyCache ? keyCache.subscribed : null,
  }
}

// Fire-and-forget from the timer path — logging never blocks on push.
export function scheduleRestAlarm(seconds) {
  if (!restAlarmEnabled()) return
  api.scheduleRestAlarm({ seconds }).catch(() => {})
}

export function cancelRestAlarm() {
  if (!restAlarmEnabled()) return
  api.cancelRestAlarm().catch(() => {})
}
