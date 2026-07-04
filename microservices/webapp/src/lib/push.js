// Rest-timer web push. The in-app timer bar handles the screen-on case; this
// covers pocket-phone rest at the gym: the server fires a push when rest
// ends and the service worker shows a notification (works on Android Chrome
// and iOS 16.4+ installed PWAs).
import { api } from '../api/client'

const FLAG = 'restAlarmEnabled'

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

export async function enableRestAlarm() {
  if (!isPushSupported()) {
    throw new Error('Notifications are not supported in this browser. On iPhone, install the app to your home screen first.')
  }
  const { public_key: publicKey } = await api.getPushPublicKey()
  if (!publicKey) {
    throw new Error('Push is not configured on the server yet')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed')
  }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  const json = sub.toJSON()
  // Exact shape only — the API rejects unknown JSON keys.
  await api.savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  })
  localStorage.setItem(FLAG, 'on')
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

// Fire-and-forget from the timer path — logging never blocks on push.
export function scheduleRestAlarm(seconds) {
  if (!restAlarmEnabled()) return
  api.scheduleRestAlarm({ seconds }).catch(() => {})
}

export function cancelRestAlarm() {
  if (!restAlarmEnabled()) return
  api.cancelRestAlarm().catch(() => {})
}
