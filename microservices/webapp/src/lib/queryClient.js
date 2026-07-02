import { QueryClient } from '@tanstack/react-query'
import { get, set, del } from 'idb-keyval'
import { api } from '../api/client'

// offlineFirst: fire the request immediately; if it fails while the browser
// is offline, mutations pause (instead of erroring) and resume on reconnect.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

// Default mutationFn registered by key so mutations restored from IndexedDB
// after a reload (queued offline, app killed) can still execute.
// Sets carrying a client_id use the idempotent POST upsert; legacy sets
// (created before client ids existed) fall back to PATCH by server id.
queryClient.setMutationDefaults(['syncSet'], {
  mutationFn: (vars) => {
    if (vars.client_id) return api.logSet(vars)
    const { id, ...body } = vars
    return api.updateSet(id, body)
  },
  retry: 3,
})

// Persist the cache (including paused mutations) to IndexedDB so an offline
// workout survives the app being killed at the gym.
export const idbPersister = {
  persistClient: (client) => set('liftnotebook-cache', client),
  restoreClient: () => get('liftnotebook-cache'),
  removeClient: () => del('liftnotebook-cache'),
}
