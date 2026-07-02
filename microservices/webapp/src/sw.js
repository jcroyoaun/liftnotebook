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
