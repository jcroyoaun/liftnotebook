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

// Rest-timer push: the server fires this when rest ends. Skip the banner
// when the app is visible — the in-app timer bar already covers that case.
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (wins.some((w) => w.visibilityState === 'visible')) return
      let data = {}
      try {
        data = event.data?.json() ?? {}
      } catch {
        // Non-JSON payload — fall back to defaults.
      }
      await self.registration.showNotification(data.title || 'Rest over — lift!', {
        body: data.body || 'Next set is waiting.',
        icon: '/pwa-192.png?v=3',
        badge: '/pwa-192.png?v=3',
        tag: 'rest-timer',
        vibrate: [200, 100, 200],
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (wins.length > 0) return wins[0].focus()
      return self.clients.openWindow('/')
    })(),
  )
})
