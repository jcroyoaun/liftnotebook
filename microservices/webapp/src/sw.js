// Service worker: app-shell precache + runtime caching for the API.
//
// Sync strategy: the main thread (TanStack Query paused mutations) is the
// PRIMARY offline replay mechanism — iOS Safari has no Background Sync API,
// so nothing here can be relied on there. The BackgroundSyncPlugin below is
// defense-in-depth for Android/Chrome, where the OS can wake this worker to
// flush the queue even after the tab is closed. Replays are safe on both
// paths because set writes are idempotent per client_id.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigations serve the cached shell; API and asset requests fall through.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/v1\//] }))

// Exercise catalog: rarely changes, fine to serve stale while refreshing.
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/v1/exercises'),
  new StaleWhileRevalidate({ cacheName: 'api-catalog' }),
)

// Session/mesocycle/suggestion reads: prefer fresh, fall back to cache offline.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.startsWith('/v1/sessions') ||
      url.pathname.startsWith('/v1/mesocycles') ||
      url.pathname.startsWith('/v1/me/') ||
      url.pathname.startsWith('/v1/training-days')),
  new NetworkFirst({ cacheName: 'api-reads', networkTimeoutSeconds: 5 }),
)

// Set logging: replay queue for Android/Chrome background sync.
const setSyncQueue = new BackgroundSyncPlugin('set-sync', { maxRetentionTime: 60 * 24 * 3 })

registerRoute(
  ({ url, request }) => request.method === 'POST' && url.pathname === '/v1/sets',
  new NetworkOnly({ plugins: [setSyncQueue] }),
  'POST',
)

// Rest-timer push: the server fires this when rest ends. ALWAYS show a
// notification for every push — on iOS each push that posts no notification
// is a userVisibleOnly violation, and after ~3 of them Safari silently
// revokes the subscription (Discourse hit this exact skip-when-visible bug).
// tag collapsing dedupes repeats; any foreground suppression must live
// server-side, never here. Payload is the Declarative Web Push shape
// ({ web_push: 8030, notification: { title, body, navigate } }), with the
// legacy flat { title, body } shape as fallback.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    // Non-JSON payload — fall back to defaults.
  }
  const note = data.notification && typeof data.notification === 'object' ? data.notification : data
  event.waitUntil(
    self.registration.showNotification(note.title || 'Rest over — lift!', {
      body: note.body || 'Next set is waiting.',
      icon: '/pwa-192.png?v=3',
      badge: '/pwa-192.png?v=3',
      tag: 'rest-timer',
      vibrate: [200, 100, 200],
      data: { navigate: note.navigate || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const navigate = event.notification.data?.navigate || '/'
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (wins.length > 0) return wins[0].focus()
      return self.clients.openWindow(navigate)
    })(),
  )
})

// Browser rotated or dropped the subscription. Best-effort resubscribe with
// the old key and hand the new subscription to the app — the SW has no auth
// token, so a window must PUT it to the server. When this event never fires
// (Safari support is spotty), the startup health check in main.jsx is the
// reliable recovery layer.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const key = event.oldSubscription?.options?.applicationServerKey
        if (!key) return
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        })
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const win of wins) {
          win.postMessage({ type: 'push-resubscribed', subscription: sub.toJSON() })
        }
      } catch {
        // Best-effort only.
      }
    })(),
  )
})
