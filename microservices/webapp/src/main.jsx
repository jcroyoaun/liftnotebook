import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.jsx'
import { queryClient, idbPersister } from './lib/queryClient'
import { ThemeProvider } from './lib/theme'
import { checkPushHealth } from './lib/push'
import { api } from './api/client'
import { getToken } from './auth/session'

// Fire-and-forget: clears the stale rest-alarm flag when iOS silently
// revoked the subscription or permission was lost. No UI at this layer —
// Settings renders the truth.
checkPushHealth()

// The SW resubscribes on pushsubscriptionchange but holds no auth token; it
// posts the fresh subscription here so the app can save it server-side.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data
    if (msg?.type !== 'push-resubscribed') return
    const sub = msg.subscription
    if (!sub?.endpoint || !sub?.keys || !getToken()) return
    // Exact shape only — the API rejects unknown JSON keys.
    api
      .savePushSubscription({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: 1000 * 60 * 60 * 24 * 3 }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
)
